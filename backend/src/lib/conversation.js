export const createRoomKey = (firstUserId, secondUserId) =>
  [firstUserId?.toString(), secondUserId?.toString()].sort().join(":");
