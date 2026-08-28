import { useState } from 'react';
import { createApiClient } from './api/client.js';
import { HistoryWorkspace } from './history/HistoryWorkspace.js';
import { ImportWorkspace } from './import/ImportWorkspace.js';

const api = createApiClient();

export function App() {
  const [workspace, setWorkspace] = useState<'import' | 'history'>('import');
  return (
    <div className="app-shell">
      <nav className="app-mode-nav" aria-label="工作台">
        <span>OPENMAPBRIDGE</span>
        <button type="button" className={workspace === 'import' ? 'active' : ''} onClick={() => setWorkspace('import')}>图源导入</button>
        <button type="button" className={workspace === 'history' ? 'active' : ''} onClick={() => setWorkspace('history')}>历史影像四期</button>
      </nav>
      {workspace === 'import' ? <ImportWorkspace api={api} /> : <HistoryWorkspace api={api} />}
    </div>
  );
}
