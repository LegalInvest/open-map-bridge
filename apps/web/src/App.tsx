import { createApiClient } from './api/client.js';
import { HistoryWorkspace } from './history/HistoryWorkspace.js';

const api = createApiClient();

export function App() {
  return <HistoryWorkspace api={api} />;
}
