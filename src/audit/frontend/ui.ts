interface AuditEventRecord {
  id: number | string;
  timestamp: string;
  toolName: string;
  executionTimeMs: number;
  status: 'SUCCESS' | 'DENIED' | 'ERROR';
  args?: Record<string, unknown>;
  fileId?: string;
  fileName?: string;
  saEmail?: string;
  sharedDriveId?: string;
  boundaryPassed?: boolean;
  boundaryReason?: string;
  errorMessage?: string;
}

interface AuditMetricsData {
  totalCalls: number;
  successCount: number;
  deniedCount: number;
  avgExecutionTimeMs: number;
  mode?: string;
}

interface AuditLogsResponse {
  logs: AuditEventRecord[];
  nextCursor?: string | number | null;
  totalCount: number;
}

// Security: Extract token from URL parameter if present
const urlParams = new URLSearchParams(window.location.search);
const queryToken = urlParams.get('token');

if (queryToken) {
  sessionStorage.setItem('mcp_token', queryToken);
  history.replaceState({}, document.title, window.location.pathname);
}

let currentLogs: AuditEventRecord[] = [];
let expandedRowId: string | number | null = null;
let cursorHistory: (string | number | null)[] = [];
let currentCursor: string | number | null = null;
let nextCursor: string | number | null = null;
let totalCount = 0;
let isRateLimited = false;
let rateLimitTimer: ReturnType<typeof setTimeout> | null = null;
let currentEventSource: EventSource | null = null;
let sseRetryTimeout: ReturnType<typeof setTimeout> | null = null;
let fetchLogsController: AbortController | null = null;
let sseDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function getToken(): string {
  return sessionStorage.getItem('mcp_token') || '';
}

function clearToken(): void {
  if (currentEventSource) {
    currentEventSource.close();
    currentEventSource = null;
  }
  if (sseRetryTimeout) {
    clearTimeout(sseRetryTimeout);
    sseRetryTimeout = null;
  }
  sessionStorage.removeItem('mcp_token');
  showModal();
}

function showModal(): void {
  const modal = document.getElementById('tokenModal');
  if (modal) modal.classList.remove('modal-hidden');
}

function hideModal(): void {
  const modal = document.getElementById('tokenModal');
  if (modal) modal.classList.add('modal-hidden');
  const modalErr = document.getElementById('modalError');
  if (modalErr) modalErr.style.display = 'none';
}

function showError(msg: string): void {
  const banner = document.getElementById('validationBanner');
  if (banner) {
    banner.innerText = msg;
    banner.style.display = 'block';
  }
  const modalErr = document.getElementById('modalError');
  if (modalErr) {
    modalErr.innerText = msg;
    modalErr.style.display = 'block';
  }
}

function clearErrors(): void {
  const banner = document.getElementById('validationBanner');
  if (banner && !isRateLimited) banner.style.display = 'none';
  const modalErr = document.getElementById('modalError');
  if (modalErr) modalErr.style.display = 'none';
}

function handleRateLimit(): void {
  if (!isRateLimited) {
    isRateLimited = true;
    showError('⏳ Too many failed authentication attempts. Please wait 1 minute before trying again.');
    if (rateLimitTimer) clearTimeout(rateLimitTimer);
    rateLimitTimer = setTimeout(() => {
      isRateLimited = false;
      clearErrors();
    }, 60000);
  }
}

function handleUnauthorized(): void {
  sessionStorage.removeItem('mcp_token');
  showError('❌ Unauthorized: Invalid or expired access token.');
  showModal();
}

const tokenForm = document.getElementById('tokenForm');
if (tokenForm) {
  tokenForm.addEventListener('submit', (e: Event) => {
    e.preventDefault();
    const tokenInput = document.getElementById('tokenInput') as HTMLInputElement | null;
    const val = tokenInput ? tokenInput.value.trim() : '';
    if (val) {
      sessionStorage.setItem('mcp_token', val);
      hideModal();
      initDashboard();
    }
  });
}

function validateInputs(): boolean {
  const startDateInput = document.getElementById('filterStartDate') as HTMLInputElement | null;
  const endDateInput = document.getElementById('filterEndDate') as HTMLInputElement | null;
  const startDate = startDateInput ? startDateInput.value : '';
  const endDate = endDateInput ? endDateInput.value : '';

  if (startDate && endDate && startDate > endDate) {
    showError('⚠️ Validation Error: Start Date cannot be after End Date.');
    return false;
  }

  clearErrors();
  return true;
}

function onFilterChange(): void {
  cursorHistory = [];
  currentCursor = null;
  nextCursor = null;
  fetchLogs();
}

function getUtcISOStartOfDay(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return isNaN(d.getTime()) ? dateStr : d.toISOString();
}

function getUtcISOEndOfDay(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T23:59:59.999');
  return isNaN(d.getTime()) ? dateStr : d.toISOString();
}

async function fetchMetrics(): Promise<void> {
  const token = getToken();
  if (!token) { showModal(); return; }

  try {
    const res = await fetch('/api/audit/metrics', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (res.status === 429) { handleRateLimit(); return; }
    if (res.status === 401) { handleUnauthorized(); return; }
    const data: AuditMetricsData = await res.json();

    const totalCallsEl = document.getElementById('metricTotalCalls');
    if (totalCallsEl) totalCallsEl.innerText = String(data.totalCalls || 0);

    const rate = data.totalCalls ? Math.round((data.successCount / data.totalCalls) * 100) : 100;
    const successRateEl = document.getElementById('metricSuccessRate');
    if (successRateEl) successRateEl.innerText = rate + '%';

    const deniedEl = document.getElementById('metricDenied');
    if (deniedEl) deniedEl.innerText = String(data.deniedCount || 0);

    const avgLatencyEl = document.getElementById('metricAvgLatency');
    if (avgLatencyEl) avgLatencyEl.innerText = Math.round(data.avgExecutionTimeMs || 0) + 'ms';
    
    const modeBadge = document.getElementById('modeBadge');
    if (modeBadge && data.mode) {
      const isReadonly = data.mode === 'read' || data.mode === 'readonly';
      modeBadge.innerHTML = isReadonly
        ? '<span class="status-dot" style="background: var(--accent-amber); box-shadow: 0 0 8px var(--accent-amber);"></span> Mode: READ-ONLY'
        : '<span class="status-dot" style="background: var(--accent-blue); box-shadow: 0 0 8px var(--accent-blue);"></span> Mode: READ-WRITE';
      modeBadge.style.background = isReadonly ? 'rgba(245, 158, 11, 0.15)' : 'rgba(56, 189, 248, 0.15)';
      modeBadge.style.color = isReadonly ? 'var(--accent-amber)' : 'var(--accent-blue)';
      modeBadge.style.borderColor = isReadonly ? 'rgba(245, 158, 11, 0.3)' : 'rgba(56, 189, 248, 0.3)';
    }
  } catch {
    // Silent catch for network aborts or temporary failures
  }
}

async function fetchLogs(): Promise<void> {
  if (!validateInputs()) return;

  const token = getToken();
  if (!token) { showModal(); return; }

  // Cancel previous pending log request
  if (fetchLogsController) {
    fetchLogsController.abort();
  }
  fetchLogsController = new AbortController();

  const toolNameInput = document.getElementById('filterTool') as HTMLSelectElement | null;
  const statusInput = document.getElementById('filterStatus') as HTMLSelectElement | null;
  const startDateInput = document.getElementById('filterStartDate') as HTMLInputElement | null;
  const endDateInput = document.getElementById('filterEndDate') as HTMLInputElement | null;
  const limitInput = document.getElementById('filterLimit') as HTMLSelectElement | null;

  const toolName = toolNameInput ? toolNameInput.value : '';
  const status = statusInput ? statusInput.value : '';
  const startDate = startDateInput ? startDateInput.value : '';
  const endDate = endDateInput ? endDateInput.value : '';
  const limit = limitInput ? limitInput.value : '20';

  const params = new URLSearchParams({ limit });
  if (toolName) params.append('toolName', toolName);
  if (status) params.append('status', status);
  if (startDate) params.append('startDate', getUtcISOStartOfDay(startDate));
  if (endDate) params.append('endDate', getUtcISOEndOfDay(endDate));
  if (currentCursor) params.append('cursor', String(currentCursor));

  try {
    const res = await fetch('/api/audit/logs?' + params.toString(), {
      headers: { 'Authorization': 'Bearer ' + token },
      signal: fetchLogsController.signal
    });
    if (res.status === 429) { handleRateLimit(); return; }
    if (res.status === 401) { handleUnauthorized(); return; }
    const data: AuditLogsResponse = await res.json();
    currentLogs = data.logs || [];
    nextCursor = data.nextCursor || null;
    totalCount = data.totalCount || 0;
    renderLogs();
    updatePaginationUI();
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') return;
  }
}

function nextPage(): void {
  if (nextCursor) {
    cursorHistory.push(currentCursor);
    currentCursor = nextCursor;
    fetchLogs();
  }
}

function prevPage(): void {
  if (cursorHistory.length > 0) {
    currentCursor = cursorHistory.pop() ?? null;
    fetchLogs();
  }
}

function updatePaginationUI(): void {
  const prevBtn = document.getElementById('prevBtn') as HTMLButtonElement | null;
  const nextBtn = document.getElementById('nextBtn') as HTMLButtonElement | null;
  const pageInfo = document.getElementById('pageInfo');

  if (prevBtn) prevBtn.disabled = cursorHistory.length === 0;
  if (nextBtn) nextBtn.disabled = !nextCursor;

  const count = currentLogs.length;
  if (pageInfo) pageInfo.innerText = `Showing ${count} log entry(s) | Total: ${totalCount}`;
}

function toggleRow(id: string | number): void {
  expandedRowId = expandedRowId === id ? null : id;
  renderLogs();
}

function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderLogs(): void {
  const tbody = document.getElementById('logsTableBody');
  if (!tbody) return;

  if (!currentLogs.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">No audit events found matching filters.</td></tr>';
    return;
  }
  
  let html = '';
  currentLogs.forEach((l: AuditEventRecord) => {
    const badgeClass = l.status === 'SUCCESS' ? 'badge-success' : (l.status === 'DENIED' ? 'badge-denied' : 'badge-error');
    const dateStr = escapeHtml(new Date(l.timestamp).toLocaleString());
    const toolNameEscaped = escapeHtml(l.toolName);
    const statusEscaped = escapeHtml(l.status);
    const latencyEscaped = escapeHtml(l.executionTimeMs);
    const isExpanded = expandedRowId === l.id;
    
    html += `<tr class="log-row" onclick="toggleRow('${escapeHtml(l.id)}')">
      <td>${dateStr}</td>
      <td><code>${toolNameEscaped}</code></td>
      <td><span class="badge ${badgeClass}">${statusEscaped}</span></td>
      <td>${latencyEscaped}ms</td>
    </tr>`;

    if (isExpanded) {
      const argsJson = escapeHtml(l.args ? JSON.stringify(l.args, null, 2) : '{}');
      const fileId = escapeHtml(l.fileId || 'N/A');
      const fileName = escapeHtml(l.fileName || 'N/A');
      const saEmail = escapeHtml(l.saEmail || 'Keyless ADC');
      const sharedDriveId = escapeHtml(l.sharedDriveId || 'N/A');
      const boundaryReason = l.boundaryReason ? escapeHtml(l.boundaryReason) : '';
      const errorMessage = l.errorMessage ? escapeHtml(l.errorMessage) : '';

      html += `<tr class="details-row">
        <td colspan="4">
          <div class="details-container">
            <div class="details-box">
              <div class="details-title">Input Arguments</div>
              <pre>${argsJson}</pre>
            </div>
            <div class="details-box">
              <div class="details-title">Execution Context</div>
              <div><strong>File ID:</strong> ${fileId}</div>
              <div><strong>File Name:</strong> ${fileName}</div>
              <div><strong>Service Account:</strong> ${saEmail}</div>
              <div><strong>Shared Drive ID:</strong> ${sharedDriveId}</div>
              <div style="margin-top: 0.4rem;"><strong>Boundary Pass:</strong> ${l.boundaryPassed !== undefined ? (l.boundaryPassed ? '✅ Passed' : '❌ Failed') : 'N/A'}</div>
              ${boundaryReason ? `<div style="color: var(--accent-amber); margin-top: 0.2rem;"><strong>Reason:</strong> ${boundaryReason}</div>` : ''}
              ${errorMessage ? `<div style="color: var(--accent-red); margin-top: 0.4rem;"><strong>Error:</strong> ${errorMessage}</div>` : ''}
            </div>
          </div>
        </td>
      </tr>`;
    }
  });

  tbody.innerHTML = html;
}

function connectSSE(): void {
  const token = getToken();
  if (!token) return;
  
  if (currentEventSource) {
    currentEventSource.close();
  }
  if (sseRetryTimeout) {
    clearTimeout(sseRetryTimeout);
  }
  
  const evtSource = new EventSource('/api/audit/stream?token=' + encodeURIComponent(token));
  currentEventSource = evtSource;

  evtSource.onmessage = () => {
    // 300ms Debounce to prevent table jittering on high-frequency SSE streams
    if (sseDebounceTimer) clearTimeout(sseDebounceTimer);
    sseDebounceTimer = setTimeout(() => {
      fetchMetrics();
      fetchLogs();
    }, 300);
  };

  evtSource.onerror = () => {
    evtSource.close();
    currentEventSource = null;
    const delay = isRateLimited ? 30000 : 5000;
    sseRetryTimeout = setTimeout(connectSSE, delay);
  };
}

function initDashboard(): void {
  if (!getToken()) {
    showModal();
  } else {
    hideModal();
    fetchMetrics();
    fetchLogs();
    connectSSE();
  }
}

// Bind handlers to window object so IIFE bundled functions remain accessible in inline HTML handlers
const win = window as unknown as Record<string, unknown>;
win.toggleRow = toggleRow;
win.onFilterChange = onFilterChange;
win.nextPage = nextPage;
win.prevPage = prevPage;
win.clearToken = clearToken;

initDashboard();