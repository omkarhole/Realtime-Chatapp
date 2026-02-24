# Contributing to Realtime Chat App

First off, thank you for considering contributing to the Realtime Chat App! It's people like you that make this tool better for everyone.

Following these guidelines helps to communicate that you respect the time of the developers managing and developing this open source project. In return, they should reciprocate that respect in addressing your issue, assessing changes, and helping you finalize your pull requests.

## Table of Contents

- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Your First Code Contribution](#your-first-code-contribution)
  - [Pull Requests](#pull-requests)
- [Styleguides](#styleguides)
  - [Git Commit Messages](#git-commit-messages)
  - [JavaScript Styleguide](#javascript-styleguide)
- [Additional Notes](#additional-notes)

## How Can I Contribute?

### Reporting Bugs

This section guides you through submitting a bug report. Following these guidelines helps maintainers and the community understand your report, reproduce the behavior, and find related bugs.

Before creating bug reports, please check [this list](#before-submitting-a-bug-report) as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title** for the issue to identify the problem.
- **Describe the exact steps which reproduce the problem** in as many details as possible.
- **Explain which behavior you expected to see and why.**
- **Include screenshots and animated GIFs** which help you demonstrate the steps or the part of the app that is not working as expected.
- **If the bug was accompanied by an error message**, include the full error output.

### Suggesting Enhancements

This section guides you through submitting an enhancement suggestion, including completely new features and minor improvements to existing functionality.

- **Use a clear and descriptive title** for the suggestion.
- **Provide a step-by-step description of the suggested enhancement** in as many details as possible.
- **Provide specific examples to demonstrate the steps.***
- **Describe the current behavior and explain which behavior you expected to see instead** and why.
- **Explain why this enhancement would be useful** to most users.

### Your First Code Contribution

Unsure where to begin contributing? You can start by looking through these `beginner` and `help-wanted` issues:

- [Beginner issues](https://github.com/omkarhole/Realtime-Chatapp/labels/beginner) - issues which should only require a few lines of code, and a test or two.
- [Help wanted issues](https://github.com/omkarhole/Realtime-Chatapp/labels/help-wanted) - issues which should be a bit more involved than `beginner` issues.

#### Local Development

1. Fork the repo.
2. Clone your fork: `git clone https://github.com/your-username/Realtime-Chatapp.git`
3. Install dependencies:
   ```bash
   # Backend
   cd backend && npm install
   # Frontend
   cd ../frontend && npm install
   ```
4. Set up environment variables as described in the [README.md](README.md#-quick-start).
5. Start development servers:
   ```bash
   # Backend
   cd backend && npm run dev
   # Frontend
   cd ../frontend && npm run dev
   ```

### Pull Requests

The process described here has several goals:
- Maintain project quality
- Fix bugs and add features
- Limit technical debt

Please follow these steps to have your contribution considered by the maintainers:

1. Follow all instructions in the [template](PULL_REQUEST_TEMPLATE.md) (if available).
2. After you submit your pull request, verify that all [status checks](https://help.github.com/articles/about-status-checks/) are passing <details><summary>What if the status checks are failing?</summary>If a status check is failing, and you believe that the failure is unrelated to your change, please leave a comment on the pull request explaining why you believe the failure is unrelated. A maintainer will re-run the status check for you. If the failure is related to your change, please update your pull request to address the failure and the status check will automatically be re-run.</details>

## Styleguides

### Git Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

### JavaScript Styleguide

- Use ES Modules (the project uses `"type": "module"`).
- Prefer `const` over `let` and `var`.
- Use arrow functions for callbacks and simple functions.
- Follow Prettier/ESLint rules defined in the project.

## Additional Notes

### Issue and Pull Request Labels

This project uses labels to help organize and prioritize issues and pull requests. Common labels include:

- `bug`: Something isn't working
- `enhancement`: New feature or request
- `documentation`: Improvements or additions to documentation
- `help wanted`: Extra attention is needed
- `good first issue`: Good for newcomers

---
*This document was inspired by [atom/CONTRIBUTING.md](https://github.com/atom/atom/blob/master/CONTRIBUTING.md).*
