# Online Status & Last Seen Feature Documentation

## Overview

The Online Status & Last Seen feature allows users to see whether their contacts are currently online or offline, and when they were last seen. This feature provides real-time presence information for individual users and group members in the chat application.

---

## Features

1. **Real-time Online Status** - Users can see who's currently online
2. **Last Seen Timestamps** - Shows when a user was last active
3. **Smart Time Formatting** - Human-readable time intervals (e.g., "Just now", "5 minutes ago")
4. **Group Presence** - Shows count of online members in group chats
5. **Auto-Update on Activity** - Last seen updates on user activity (typing, messaging)

---

## Backend Implementation

### 1. User Model (`backend/src/models/user.model.js`)

The `lastSeen` field was added to the user schema:

```
javascript
lastSeen: {
    type: Date,
    default: null,
}
```

### 2. Socket.io Server (`backend/src/lib/socket.js`)

The socket server manages real-time presence tracking:

#### Key Variables:
- `userSocketMap` - Object mapping `userId` to `socketId` for all connected users

#### Socket Events:

| Event | Description | Action |
|-------|-------------|--------|
| `connection` | User connects | Add to `userSocketMap`, update `lastSeen`, emit `userOnline` |
| `disconnect` | User disconnects | Remove from `userSocketMap`, update `lastSeen`, emit `userOffline` |
| `activity` | User activity (typing, messaging) | Update `lastSeen` timestamp |
| `getOnlineUsers` | Request online users | Emit list of all online user IDs |
| `userOnline` | Broadcast user came online | Notify all clients |
| `userOffline` | Broadcast user went offline | Notify all clients with last seen |

#### Code Example:
```
javascript
io.on("connection", (socket) => {
    const userId = socket.user?._id;
    
    // Add to online users map
    userSocketMap[userId] = socket.id;
    
    // Update last seen on connect
    User.findByIdAndUpdate(userId, { lastSeen: new Date() });
    
    // Broadcast user online
    io.emit("userOnline", { userId });
    
    // Send list of all online users
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
    
    socket.on("disconnect", () => {
        delete userSocketMap[userId];
        
        // Update last seen on disconnect
        User.findByIdAndUpdate(userId, { lastSeen: new Date() });
        
        io.emit("userOffline", { userId, lastSeen: new Date() });
        io.emit("getOnlineUsers", Object.keys(userSocketMap));
    });
    
    // Update last seen on activity
    socket.on("activity", () => {
        User.findByIdAndUpdate(userId, { lastSeen: new Date() });
    });
});
```

### 3. Auth Controller (`backend/src/controllers/auth.controller.js`)

#### API Endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/auth/users/online` | Get all online user IDs |
| `GET` | `/api/auth/users/:id/status` | Get specific user's status |

#### `getOnlineUsers` Controller:
```
javascript
export const getOnlineUsers = async (req, res) => {
    const { userSocketMap } = await import("../lib/socket.js");
    const onlineUserIds = Object.keys(userSocketMap);
    res.status(200).json(onlineUserIds);
}
```

#### `getUserStatus` Controller:
```
javascript
export const getUserStatus = async (req, res) => {
    const { id } = req.params;
    const user = await User.findById(id).select("lastSeen");
    
    const { userSocketMap } = await import("../lib/socket.js");
    const isOnline = !!userSocketMap[id];
    
    res.status(200).json({
        userId: id,
        isOnline,
        lastSeen: user.lastSeen
    });
}
```

### 4. Routes (`backend/src/routes/auth.route.js`)

```
javascript
router.get("/users/online", protectRoute, getOnlineUsers);
router.get("/users/:id/status", protectRoute, getUserStatus);
```

---

## Frontend Implementation

### 1. Utility Functions (`frontend/src/lib/utils.js`)

The `formatLastSeen` function provides smart time formatting:

```
javascript
export function formatLastSeen(date) {
    if (!date) return "Unknown";
    
    const now = new Date();
    const lastSeenDate = new Date(date);
    const diffInSeconds = Math.floor((now - lastSeenDate) / 1000);
    
    if (diffInSeconds < 60) {
        return "Just now";
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
        return `Last seen ${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
        return `Last seen ${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
        return `Last seen ${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    }
    
    return `Last seen on ${lastSeenDate.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    })}`;
}
```

### 2. Auth Store (`frontend/src/store/useAuthStore.js`)

The store manages online users state:

```
javascript
export const useAuthStore = create((set, get) => ({
    onlineUsers: [],
    socket: null,
    
    connectSocket: () => {
        const socket = io(BASE_URL, {
            query: { userId: authUser._id },
            auth: { token }
        });
        
        socket.on("getOnlineUsers", (userIds) => {
            set({ onlineUsers: userIds });
        });
        
        set({ socket });
    },
    
    disConnectSocket: () => {
        if (get().socket?.connected) get().socket.disconnect();
    },
}));
```

### 3. Sidebar Component (`frontend/src/components/Sidebar.jsx`)

#### Features:
- Online indicator (green dot) on user avatars
- "Show online only" filter toggle
- Display online status or last seen in user list

#### Code Example:
```
jsx
{/* Online Indicator */}
{onlineUsers.includes(user._id) && (
    <span className="absolute bottom-0 right-0 size-3 bg-green-500 rounded-full ring-2 ring-zinc-900" />
)}

{/* Status Display */}
<div className="text-sm text-zinc-400">
    {onlineUsers.includes(user._id) 
        ? "Online" 
        : formatLastSeen(user.lastSeen)
    }
</div>
```

### 4. Chat Header Component (`frontend/src/components/ChatHeader.jsx`)

#### Features:
- Individual chat: Shows "Online" or formatted last seen
- Group chat: Shows count of online members

#### Code Example:
```
jsx
{/* Individual Chat Status */}
{isGroup ? (
    onlineMembers.length > 0 
        ? `${onlineMembers.length} online`
        : getGroupSubtitle()
) : (
    onlineUsers.includes(selectedUser._id) 
        ? "Online" 
        : formatLastSeen(selectedUser.lastSeen)
)}
```

---

## User Flow

### 1. User Login
1. User submits login credentials
2. Server validates and creates JWT token
3. Server updates `lastSeen` to current time
4. Client connects to socket with JWT token
5. Socket adds user to `userSocketMap`
6. Socket broadcasts `userOnline` event
7. All connected clients receive updated online users list

### 2. Viewing Contact Status
1. User opens Sidebar
2. App displays list of users with online status indicators
3. For online users: Shows green dot + "Online" text
4. For offline users: Shows "Last seen X ago" text

### 3. Opening Chat
1. User clicks on a user in the sidebar
2. ChatHeader displays selected user's full status
3. If online: Shows "Online" status
4. If offline: Shows formatted last seen (e.g., "Last seen 5 minutes ago")

### 4. User Activity
1. User types a message or sends a message
2. Socket emits `activity` event
3. Server updates `lastSeen` to current timestamp

### 5. User Disconnect
1. User closes browser/tab or logs out
2. Socket connection closes
3. Server removes user from `userSocketMap`
4. Server updates `lastSeen` to disconnect time
5. Server broadcasts `userOffline` event with last seen
6. All clients update their online users list

---

## Data Flow Diagram

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Client A  │         │   Server    │         │   Client B  │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                        │                        │
       │─── Connect (JWT) ─────>│                        │
       │                        │                        │
       │<── userOnline ────────│                        │
       │<─ getOnlineUsers ─────│                        │
       │                        │                        │
       │                        │<─── Connect (JWT) ────│
       │                        │                        │
       │<─ userOnline ──────────│<──── Broadcast ──────│
       │                        │                        │
       │─── typing ────────────>│                        │
       │                        │─── typing ──────────>│
       │                        │                        │
       │─── activity ──────────>│                        │
       │                        │─── lastSeen update ──>│ (DB)
       │                        │                        │
       │<── userOffline ────────│<─── Disconnect ──────│
       │<─ getOnlineUsers ──────│                        │
```

---

## Database Schema

### User Collection
```
javascript
{
    _id: ObjectId,
    email: String,
    fullName: String,
    password: String (hashed),
    profilePic: String,
    lastSeen: Date,        // ← Added for presence tracking
    createdAt: Date,
    updatedAt: Date
}
```

---

## Security Considerations

1. **Authentication**: Socket connections require JWT token authentication
2. **Authorization**: Status endpoints are protected with `protectRoute` middleware
3. **Privacy**: Last seen timestamps are only shared with authenticated users
4. **Token Validation**: Tokens are verified on every socket connection

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| User closes tab without logging out | Socket disconnects, lastSeen updated |
| Network connection lost | Socket auto-reconnects, lastSeen updated on disconnect |
| Multiple tabs open | Same userId maps to multiple socketIds |
| User never goes online | lastSeen remains null or last known time |
| Very old lastSeen | Shows formatted date (e.g., "Last seen on 15 Jan 2024") |

---

## Dependencies

### Backend
- `socket.io` - WebSocket server
- `jsonwebtoken` - JWT authentication
- `mongoose` - MongoDB ODM

### Frontend
- `socket.io-client` - WebSocket client
- `zustand` - State management

---

## Future Enhancements

1. **Typing indicators** - Show when user is typing (already implemented)
2. **Read receipts** - Show when messages are read (already implemented)
3. **Custom status messages** - Allow users to set custom status
4. **Privacy controls** - Allow users to hide last seen
5. **Push notifications** - Notify when contact comes online
