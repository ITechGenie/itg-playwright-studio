import * as fc from 'fast-check';
import { describe, it } from 'vitest';
import { AuthError, createStudioClient } from '../studio-client';

describe('studio-client', () => {
  /**
   * Property 8: Auth Errors Always Surface
   * For any Studio API endpoint, HTTP 401 or 403 SHALL always throw AuthError
   * and SHALL NOT return a successful result.
   * Validates: Requirements 6.1, 6.2, 6.3, 6.5, 11.1, 11.4
   */
  it('Property 8: Auth Errors Always Surface', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(401 as const, 403 as const),
        fc.constantFrom(
          'getMe' as const,
          'getProjects' as const,
          'getEnvironments' as const,
          'getDatasets' as const
        ),
        async (statusCode, method) => {
          const mockFetch = async () =>
            ({ ok: false, status: statusCode, json: async () => ({}) } as Response);

          const client = createStudioClient('http://mock', 'pat_test', mockFetch);

          try {
            if (method === 'getMe') await client.getMe();
            else if (method === 'getProjects') await client.getProjects();
            else if (method === 'getEnvironments') await client.getEnvironments('proj1');
            else if (method === 'getDatasets') await client.getDatasets('proj1');
            return false; // should have thrown
          } catch (err) {
            return err instanceof AuthError;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
