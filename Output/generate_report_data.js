const fs = require('fs');
const path = require('path');

// Outputフォルダのパス
const outputDir = __dirname;
const outputFile = path.join(outputDir, 'report_data.json');

// 日付をパースする関数
function parseDate(dateStr) {
    const match = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (match) {
        const year = match[1];
        const month = match[2].padStart(2, '0');
        const day = match[3].padStart(2, '0');
        return `${year}-${month}-${day}`;
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
        planned: [],
        priority: {
            high: [],
            medium: [],
            low: []
        }
    };

    let currentSection = '';
    let taskList = [];
    let priorityText = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // 日付を抽出
        if (line.startsWith('**日付**:')) {
            const dateMatch = line.match(/\*\*日付\*\*:\s*(.+)/);
            if (dateMatch) {
                report.date = parseDate(dateMatch[1]);
            }
        }

        // 優先度を抽出
        if (line.startsWith('**優先度**:')) {
            const priorityMatch = line.match(/\*\*優先度\*\*:\s*(.+)/);
            if (priorityMatch) {
                priorityText = priorityMatch[1];
            }
        }

        // セクションを検出
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

    // 優先度を解析
    if (priorityText) {
        const highMatch = priorityText.match(/高\[([^\]]+)\]/);
        const mediumMatch = priorityText.match(/中\[([^\]]+)\]/);
        const lowMatch = priorityText.match(/低\[([^\]]+)\]/);

        if (highMatch) {
            report.priority.high = highMatch[1].split(/[、,]/).map(t => t.trim()).filter(t => t);
        }
        if (mediumMatch) {
            report.priority.medium = mediumMatch[1].split(/[、,]/).map(t => t.trim()).filter(t => t);
        }
        if (lowMatch) {
            report.priority.low = lowMatch[1].split(/[、,]/).map(t => t.trim()).filter(t => t);
        }
    }

    return report;
}

// 日報ファイルを読み込む
function loadReports() {
    const reports = [];
    const files = fs.readdirSync(outputDir);

    files.forEach(file => {
        if (file.endsWith('_日報.md')) {
            const filePath = path.join(outputDir, file);
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                const report = parseReport(content, file);
                if (report.date || report.tasks.length > 0) {
                    reports.push(report);
                }
            } catch (error) {
                console.error(`Error reading ${file}:`, error.message);
            }
        }
    });

    // 日付でソート
    reports.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return a.date.localeCompare(b.date);
    });

    return reports;
}

// メイン処理
const reports = loadReports();
const jsonContent = JSON.stringify(reports, null, 2);

fs.writeFileSync(outputFile, jsonContent, 'utf-8');
console.log(`✅ ${reports.length}件の日報データを ${outputFile} に出力しました。`);
