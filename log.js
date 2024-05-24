import chalk from 'chalk';

export function prettyLog(message, type = 'info') {
  const timestamp = chalk.gray(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta', hour12: false }));
  const typeLabel = {
    'error': chalk.red('[ERROR]'),
    'warning': chalk.yellow('[WARNING]'),
    'success': chalk.green('[SUCCESS]'),
    'info': chalk.blue('[INFO]')
  }[type.toLowerCase()] || chalk.blue('[INFO]');
  
  const logWidth = 53; // Define the width of the log message
  const baseLog = `[${timestamp}] ${typeLabel} `;
  const paddingLength = Math.max(logWidth - baseLog.length, 0);
  const paddedBaseLog = baseLog + ' '.repeat(paddingLength); // Add padding to justify the log message

  console.log(paddedBaseLog + ':' + message);
}

