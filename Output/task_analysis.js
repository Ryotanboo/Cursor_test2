// 日報データを格納
let reportData = [];
let allTasks = [];
let filteredTasks = [];

// カテゴリ定義
const categories = {
    'クライアント対応': ['クライアント', '顧客', '商談', 'ヒアリング', '提案', '要件'],
    '資料作成': ['資料', 'スライド', '提案書', '企画書', 'レポート', '作成'],
    '会議・打ち合わせ': ['会議', 'ミーティング', '打ち合わせ', 'スタンドアップ', 'キックオフ', 'レビュー'],
    'システム・開発': ['システム', 'バグ', 'デプロイ', 'メンテナンス', 'ワークフロー', '実装'],
    'セミナー・講座': ['セミナー', '講座', '会場', '告知', '参加者', 'ハンズオン'],
    '広告・マーケティング': ['広告', 'キャンペーン', 'クリエイティブ', 'ABテスト', 'マーケティング'],
    '動画・コンテンツ': ['動画', '編集', 'フィードバック', 'コンテンツ'],
    'その他': []
};

// カテゴリを判定する関数
function categorizeTask(task) {
    const taskLower = task.toLowerCase();
    for (const [category, keywords] of Object.entries(categories)) {
        if (category === 'その他') continue;
        for (const keyword of keywords) {
            if (taskLower.includes(keyword.toLowerCase())) {
                return category;
            }
        }
    }
    return 'その他';
}

// 日付をパースする関数
function parseDate(dateStr) {
    const match = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (match) {
        const year = match[1];
        const month = match[2].padStart(2, '0');
        const day = match[3].padStart(2, '0');
        return new Date(`${year}-${month}-${day}`);
    }
    return null;
}

// Markdownファイルをパースする関数
function parseReport(content, filename) {
    const lines = content.split('\n');
    const report = {
        filename: filename,
        date: null,
        tasks: [],
        completed: [],
        planned: []
    };

    let currentSection = '';
    let taskList = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // 日付を抽出
        if (line.startsWith('**日付**:')) {
            const dateMatch = line.match(/\*\*日付\*\*:\s*(.+)/);
            if (dateMatch) {
                report.date = parseDate(dateMatch[1]);
            }
        }

        // セクションを検出（新しいセクションが始まったとき、前のセクションのタスクを保存）
        if (line.startsWith('##')) {
            // 前のセクションのタスクを保存
            if (currentSection && taskList.length > 0) {
                if (currentSection === 'tasks') {
                    report.tasks = [...taskList];
                } else if (currentSection === 'completed') {
                    report.completed = [...taskList];
                } else if (currentSection === 'planned') {
                    report.planned = [...taskList];
                }
            }
            
            // 新しいセクションを設定
            taskList = [];
            if (line.includes('本日の業務内容')) {
                currentSection = 'tasks';
            } else if (line.includes('本日の成果')) {
                currentSection = 'completed';
            } else if (line.includes('明日の予定')) {
                currentSection = 'planned';
            } else {
                currentSection = '';
            }
        }

        // タスクを抽出（- で始まる行）
        if (line.startsWith('- ') && currentSection) {
            const taskText = line.substring(2).trim();
            if (taskText && !taskText.startsWith('[') && !taskText.includes('記入')) {
                taskList.push(taskText);
            }
        }
    }

    // 最後のセクションを保存
    if (taskList.length > 0) {
        if (currentSection === 'tasks') {
            report.tasks = [...taskList];
        } else if (currentSection === 'completed') {
            report.completed = [...taskList];
        } else if (currentSection === 'planned') {
            report.planned = [...taskList];
        }
    }

    return report;
}

// タスクを正規化する関数（類似タスクを統合）
function normalizeTask(task) {
    // 日付や数値などの具体的な情報を除去して、タスクの本質を抽出
    let normalized = task
        .replace(/\d+件/g, 'N件')
        .replace(/\d+分/g, 'N分')
        .replace(/\d+名/g, 'N名')
        .replace(/\d+案/g, 'N案')
        .replace(/\d+つ/g, 'Nつ')
        .replace(/\d+個/g, 'N個')
        .replace(/[0-9]/g, '')
        .replace(/を/g, '')
        .replace(/に/g, '')
        .replace(/の/g, '')
        .replace(/、/g, '')
        .replace(/。/g, '')
        .trim();
    
    // 最初の20文字程度で比較（長すぎるタスクを短縮）
    if (normalized.length > 30) {
        normalized = normalized.substring(0, 30);
    }
    
    return normalized;
}

// タスクを抽出して統合
function extractTasks() {
    allTasks = [];
    const taskMap = new Map();

    reportData.forEach(report => {
        // 本日の業務内容
        report.tasks.forEach(task => {
            const normalized = normalizeTask(task);
            const key = `${normalized}_${report.date?.toISOString() || 'unknown'}`;
            
            if (!taskMap.has(key)) {
                const category = categorizeTask(task);
                taskMap.set(key, {
                    id: key,
                    text: task,
                    normalized: normalized,
                    category: category,
                    date: report.date,
                    type: 'tasks',
                    count: 1,
                    completed: false
                });
            } else {
                taskMap.get(key).count++;
            }
        });

        // 明日の予定
        report.planned.forEach(task => {
            const normalized = normalizeTask(task);
            const key = `${normalized}_planned_${report.date?.toISOString() || 'unknown'}`;
            
            if (!taskMap.has(key)) {
                const category = categorizeTask(task);
                taskMap.set(key, {
                    id: key,
                    text: task,
                    normalized: normalized,
                    category: category,
                    date: report.date,
                    type: 'planned',
                    count: 1,
                    completed: false
                });
            } else {
                taskMap.get(key).count++;
            }
        });

        // 本日の成果（完了したタスク）
        report.completed.forEach(task => {
            const normalized = normalizeTask(task);
            const key = `${normalized}_completed_${report.date?.toISOString() || 'unknown'}`;
            
            if (!taskMap.has(key)) {
                const category = categorizeTask(task);
                taskMap.set(key, {
                    id: key,
                    text: task,
                    normalized: normalized,
                    category: category,
                    date: report.date,
                    type: 'completed',
                    count: 1,
                    completed: true
                });
            } else {
                taskMap.get(key).count++;
            }
        });
    });

    // 予定と成果のマッチング
    reportData.forEach(report => {
        report.planned.forEach(plannedTask => {
            const normalized = normalizeTask(plannedTask);
            report.completed.forEach(completedTask => {
                const completedNormalized = normalizeTask(completedTask);
                // 類似度が高い場合、完了としてマーク
                if (normalized.includes(completedNormalized.substring(0, 10)) || 
                    completedNormalized.includes(normalized.substring(0, 10))) {
                    const key = `${normalized}_planned_${report.date?.toISOString() || 'unknown'}`;
                    const task = Array.from(taskMap.values()).find(t => 
                        t.normalized === normalized && t.date?.getTime() === report.date?.getTime() && t.type === 'planned'
                    );
                    if (task) {
                        task.completed = true;
                        task.type = 'both';
                    }
                }
            });
        });
    });

    allTasks = Array.from(taskMap.values());
}

// フィルタリング
function filterTasks() {
    filteredTasks = allTasks.filter(task => {
        // 日付フィルタ
        const dateFrom = document.getElementById('dateFrom').value;
        const dateTo = document.getElementById('dateTo').value;
        
        if (dateFrom && task.date) {
            const fromDate = new Date(dateFrom);
            if (task.date < fromDate) return false;
        }
        
        if (dateTo && task.date) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59);
            if (task.date > toDate) return false;
        }

        // カテゴリフィルタ
        const categoryFilter = document.getElementById('categoryFilter').value;
        if (categoryFilter && task.category !== categoryFilter) return false;

        // 検索フィルタ
        const searchInput = document.getElementById('searchInput').value.toLowerCase();
        if (searchInput && !task.text.toLowerCase().includes(searchInput)) return false;

        return true;
    });
}

// 統計を更新
function updateStats() {
    const totalTasks = filteredTasks.length;
    const uniqueTasks = new Set(filteredTasks.map(t => t.normalized)).size;
    
    const dates = filteredTasks.map(t => t.date).filter(d => d);
    let dateRange = '-';
    if (dates.length > 0) {
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}/${month}/${day}`;
        };
        dateRange = `${formatDate(minDate)} ～ ${formatDate(maxDate)}`;
    }

    const completedCount = filteredTasks.filter(t => t.completed || t.type === 'completed').length;
    const completionRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

    document.getElementById('totalTasks').textContent = totalTasks;
    document.getElementById('uniqueTasks').textContent = uniqueTasks;
    document.getElementById('dateRange').textContent = dateRange;
    document.getElementById('completionRate').textContent = `${completionRate}%`;
}

// グラフを更新
let frequencyChart, categoryChart, timelineChart, completionChart;

function updateCharts() {
    // タスク頻度トップ10
    const taskFrequency = {};
    filteredTasks.forEach(task => {
        const key = task.normalized;
        if (!taskFrequency[key]) {
            taskFrequency[key] = {
                text: task.text.length > 30 ? task.text.substring(0, 30) + '...' : task.text,
                count: 0
            };
        }
        taskFrequency[key].count += task.count;
    });

    const topTasks = Object.values(taskFrequency)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    if (frequencyChart) frequencyChart.destroy();
    const freqCtx = document.getElementById('frequencyChart').getContext('2d');
    frequencyChart = new Chart(freqCtx, {
        type: 'bar',
        data: {
            labels: topTasks.map(t => t.text),
            datasets: [{
                label: '出現回数',
                data: topTasks.map(t => t.count),
                backgroundColor: 'rgba(74, 144, 226, 0.8)',
                borderColor: 'rgba(74, 144, 226, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });

    // カテゴリ別タスク数
    const categoryCount = {};
    filteredTasks.forEach(task => {
        categoryCount[task.category] = (categoryCount[task.category] || 0) + task.count;
    });

    if (categoryChart) categoryChart.destroy();
    const catCtx = document.getElementById('categoryChart').getContext('2d');
    categoryChart = new Chart(catCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categoryCount),
            datasets: [{
                data: Object.values(categoryCount),
                backgroundColor: [
                    'rgba(74, 144, 226, 0.8)',
                    'rgba(80, 200, 120, 0.8)',
                    'rgba(255, 107, 107, 0.8)',
                    'rgba(255, 206, 86, 0.8)',
                    'rgba(153, 102, 255, 0.8)',
                    'rgba(255, 159, 64, 0.8)',
                    'rgba(54, 162, 235, 0.8)',
                    'rgba(201, 203, 207, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true
        }
    });

    // 日付別タスク数
    const dateCount = {};
    filteredTasks.forEach(task => {
        if (task.date) {
            const year = task.date.getFullYear();
            const month = String(task.date.getMonth() + 1).padStart(2, '0');
            const day = String(task.date.getDate()).padStart(2, '0');
            const dateStr = `${year}/${month}/${day}`;
            dateCount[dateStr] = (dateCount[dateStr] || 0) + task.count;
        }
    });

    const sortedDates = Object.keys(dateCount).sort((a, b) => {
        return new Date(a) - new Date(b);
    });

    if (timelineChart) timelineChart.destroy();
    const timelineCtx = document.getElementById('timelineChart').getContext('2d');
    timelineChart = new Chart(timelineCtx, {
        type: 'line',
        data: {
            labels: sortedDates,
            datasets: [{
                label: 'タスク数',
                data: sortedDates.map(d => dateCount[d]),
                borderColor: 'rgba(74, 144, 226, 1)',
                backgroundColor: 'rgba(74, 144, 226, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    // 予定 vs 成果
    const plannedCount = filteredTasks.filter(t => t.type === 'planned' || t.type === 'both').length;
    const completedCount = filteredTasks.filter(t => t.type === 'completed' || t.type === 'both').length;
    const bothCount = filteredTasks.filter(t => t.type === 'both').length;

    if (completionChart) completionChart.destroy();
    const compCtx = document.getElementById('completionChart').getContext('2d');
    completionChart = new Chart(compCtx, {
        type: 'bar',
        data: {
            labels: ['予定のみ', '成果のみ', '予定→成果'],
            datasets: [{
                label: 'タスク数',
                data: [
                    plannedCount - bothCount,
                    completedCount - bothCount,
                    bothCount
                ],
                backgroundColor: [
                    'rgba(255, 206, 86, 0.8)',
                    'rgba(255, 107, 107, 0.8)',
                    'rgba(80, 200, 120, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// テーブルを更新
function updateTable() {
    const tbody = document.getElementById('taskTableBody');
    tbody.innerHTML = '';

    const sortedTasks = [...filteredTasks].sort((a, b) => {
        if (a.date && b.date) {
            return b.date - a.date;
        }
        return 0;
    });

    sortedTasks.forEach(task => {
        const row = document.createElement('tr');
        let dateStr = '-';
        if (task.date) {
            const year = task.date.getFullYear();
            const month = String(task.date.getMonth() + 1).padStart(2, '0');
            const day = String(task.date.getDate()).padStart(2, '0');
            dateStr = `${year}/${month}/${day}`;
        }
        const typeClass = task.type === 'planned' ? 'planned' : 
                         task.type === 'completed' ? 'completed' : 'both';
        const typeText = task.type === 'planned' ? '予定' : 
                        task.type === 'completed' ? '成果' : '予定→成果';
        const completionClass = task.completed ? 'completed' : 'pending';
        const completionText = task.completed ? '完了' : '未完了';

        row.innerHTML = `
            <td>${dateStr}</td>
            <td class="task-text">${task.text}</td>
            <td><span class="category-badge">${task.category}</span></td>
            <td><span class="type-badge ${typeClass}">${typeText}</span></td>
            <td>${task.count}</td>
            <td><span class="completion-status ${completionClass}">${completionText}</span></td>
        `;
        tbody.appendChild(row);
    });

    document.getElementById('taskCount').textContent = `${filteredTasks.length}件のタスク`;
}

// CSVエクスポート
function exportToCSV() {
    const headers = ['日付', 'タスク', 'カテゴリ', 'タイプ', '出現回数', '完了状況'];
    const rows = filteredTasks.map(task => {
        let dateStr = '-';
        if (task.date) {
            const year = task.date.getFullYear();
            const month = String(task.date.getMonth() + 1).padStart(2, '0');
            const day = String(task.date.getDate()).padStart(2, '0');
            dateStr = `${year}/${month}/${day}`;
        }
        const typeText = task.type === 'planned' ? '予定' : 
                        task.type === 'completed' ? '成果' : '予定→成果';
        const completionText = task.completed ? '完了' : '未完了';
        return [
            dateStr,
            `"${task.text.replace(/"/g, '""')}"`,
            task.category,
            typeText,
            task.count,
            completionText
        ];
    });

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `task_analysis_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

// 分析実行
function analyze() {
    if (reportData.length === 0) {
        alert('日報ファイルを選択してください。');
        return;
    }

    extractTasks();
    filterTasks();
    updateStats();
    updateCharts();
    updateTable();

    // カテゴリフィルタのオプションを更新
    const categoryFilter = document.getElementById('categoryFilter');
    const currentValue = categoryFilter.value;
    categoryFilter.innerHTML = '<option value="">すべて</option>';
    
    const uniqueCategories = [...new Set(allTasks.map(t => t.category))].sort();
    uniqueCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categoryFilter.appendChild(option);
    });
    
    categoryFilter.value = currentValue;
}

// イベントリスナー
document.getElementById('fileInput').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';

    reportData = [];

    for (const file of files) {
        if (file.name.endsWith('.md')) {
            const content = await file.text();
            const report = parseReport(content, file.name);
            if (report.date || report.tasks.length > 0) {
                reportData.push(report);
                
                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                fileItem.textContent = `${file.name} (${report.tasks.length + report.planned.length + report.completed.length}タスク)`;
                fileList.appendChild(fileItem);
            }
        }
    }

    if (reportData.length > 0) {
        // 自動的に分析実行
        analyze();
    }
});

document.getElementById('analyzeBtn').addEventListener('click', analyze);
document.getElementById('categoryFilter').addEventListener('change', analyze);
document.getElementById('searchInput').addEventListener('input', analyze);
document.getElementById('dateFrom').addEventListener('change', analyze);
document.getElementById('dateTo').addEventListener('change', analyze);
document.getElementById('exportBtn').addEventListener('click', exportToCSV);

// 初期化時に日報ファイルを自動読み込み（可能な場合）
window.addEventListener('DOMContentLoaded', () => {
    // ファイル選択を促すメッセージを表示
    console.log('日報ファイルを選択してください。');
});

