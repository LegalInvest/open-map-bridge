import { useState } from 'react';
import { createApiClient } from './api/client.js';
import { HistoryWorkspace } from './history/HistoryWorkspace.js';
import { ImportWorkspace } from './import/ImportWorkspace.js';
import { AutomationWorkspace } from './automation/AutomationWorkspace.js';

const api = createApiClient();

export function App() {
  const [workspace, setWorkspace] = useState<'import' | 'automation' | 'history'>('import');
  return (
    <div className="app-shell">
      <nav className="app-mode-nav" aria-label="工作台">
        <span>OPENMAPBRIDGE</span>
        <button type="button" className={workspace === 'import' ? 'active' : ''} onClick={() => setWorkspace('import')}>图源导入</button>
        <button type="button" className={workspace === 'automation' ? 'active' : ''} onClick={() => setWorkspace('automation')}>任务驾驶舱</button>
        <button type="button" className={workspace === 'history' ? 'active' : ''} onClick={() => setWorkspace('history')}>历史影像四期</button>
      </nav>
      {workspace === 'import' ? <ImportWorkspace api={api} onOpenAutomation={() => setWorkspace('automation')} /> : null}
      {workspace === 'automation' ? <AutomationWorkspace api={api} onOpenImport={() => setWorkspace('import')} /> : null}
      {workspace === 'history' ? <HistoryWorkspace api={api} /> : null}
    </div>
  );
}
