import type { UseMutationResult } from '@tanstack/react-query'
type Foo = UseMutationResult<string, Error, { id: string }, unknown>['error']
