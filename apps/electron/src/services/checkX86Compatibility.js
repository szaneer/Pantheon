/**
 * x86 Compatibility Checker for Electron App
 * Checks and logs potential issues on x86 Macs
 */

const os = require('os');
const { execSync } = require('child_process');

function checkX86Compatibility() {
  const report = {
    architecture: process.arch,
    platform: process.platform,
    osVersion: os.release(),
    nodeVersion: process.version,
    electronVersion: process.versions.electron,
    cpuModel: os.cpus()[0]?.model || 'Unknown',
    totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + ' GB',
    issues: [],
    recommendations: []
  };

  // Check if running on x86
  if (process.arch === 'x64' || process.arch === 'ia32') {
    report.isX86 = true;
    
    // Check macOS version
    if (process.platform === 'darwin') {
      try {
        const macVersion = execSync('sw_vers -productVersion').toString().trim();
        report.macOSVersion = macVersion;
        
        // Check if running through Rosetta
        try {
          const isRosetta = execSync('sysctl -n sysctl.proc_translated').toString().trim();
          if (isRosetta === '1') {
            report.runningThroughRosetta = true;
            report.issues.push('Running x86 app through Rosetta 2 translation');
            report.recommendations.push('Consider using the ARM64 build for better performance');
          }
        } catch (e) {
          // Not running through Rosetta
          report.runningThroughRosetta = false;
        }
      } catch (e) {
        console.error('Failed to check macOS version:', e);
      }
    }
    
    // Check CPU capabilities
    const cpuCount = os.cpus().length;
    if (cpuCount < 4) {
      report.issues.push(`Low CPU core count: ${cpuCount} cores`);
      report.recommendations.push('P2P performance may be limited on systems with fewer cores');
    }
    
    // Check available memory
    const freeMemGB = Math.round(os.freemem() / 1024 / 1024 / 1024);
    if (freeMemGB < 2) {
      report.issues.push(`Low available memory: ${freeMemGB} GB free`);
      report.recommendations.push('Close unnecessary applications to free up memory');
    }
    
    // WebRTC module check
    try {
      require('@roamhq/wrtc');
      report.webRTCModuleAvailable = true;
    } catch (e) {
      report.webRTCModuleAvailable = false;
      report.issues.push('Native WebRTC module not available for x86');
      report.recommendations.push('P2P connections may fail - rebuild node modules for x86');
    }
  } else {
    report.isX86 = false;
  }
  
  return report;
}

// Log compatibility report
function logCompatibilityReport() {
  const report = checkX86Compatibility();
  
  console.log('\n🔍 x86 Compatibility Check Report');
  console.log('================================');
  console.log(`Architecture: ${report.architecture}`);
  console.log(`Platform: ${report.platform} ${report.macOSVersion || ''}`);
  console.log(`Node: ${report.nodeVersion}, Electron: ${report.electronVersion}`);
  console.log(`CPU: ${report.cpuModel}`);
  console.log(`Memory: ${report.totalMemory}`);
  
  if (report.runningThroughRosetta) {
    console.log('⚠️  Running through Rosetta 2 translation');
  }
  
  if (report.issues.length > 0) {
    console.log('\n⚠️  Issues Found:');
    report.issues.forEach(issue => console.log(`  - ${issue}`));
  }
  
  if (report.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    report.recommendations.forEach(rec => console.log(`  - ${rec}`));
  }
  
  if (report.isX86 && report.webRTCModuleAvailable) {
    console.log('\n✅ WebRTC module is available for x86');
  }
  
  console.log('================================\n');
  
  return report;
}

module.exports = {
  checkX86Compatibility,
  logCompatibilityReport
};