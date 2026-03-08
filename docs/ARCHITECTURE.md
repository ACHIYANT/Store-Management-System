# Architecture

## Monorepo
- backend/AuthService
- backend/StoreManagementService
- frontend

## Branching
- main: production-ready
- develop: integration/testing
- feature/*, fix/*, hotfix/*

## Release
- PR to develop
- squash merge
- periodic PR develop -> main
- tag release: vX.Y.Z
