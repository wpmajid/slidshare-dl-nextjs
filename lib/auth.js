import { API_KEY } from './settings';

export function isAuthorized(req) {
  return req.headers.get('x-api-key') === API_KEY;
}
