/**
 * OS Version Check Utility
 * Provides utilities for checking macOS version and feature availability
 */

const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class OSVersionCheck {
  constructor() {
    this.cachedVersion = null;
    this.cachedChecks = new Map();
  }

  /**
   * Get the current macOS version
   * @returns {Promise<{major: number, minor: number, patch: number, versionString: string}>}
   */
  async getMacOSVersion() {
    if (this.cachedVersion) {
      return this.cachedVersion;
    }

    if (os.platform() !== 'darwin') {
      throw new Error('Not running on macOS');
    }

    try {
      const { stdout } = await execAsync('sw_vers -productVersion');
      const versionString = stdout.trim();
      const parts = versionString.split('.');
      
      this.cachedVersion = {
        major: parseInt(parts[0]) || 0,
        minor: parseInt(parts[1]) || 0,
        patch: parseInt(parts[2]) || 0,
        versionString
      };

      return this.cachedVersion;
    } catch (error) {
      console.error('Failed to get macOS version:', error);
      throw error;
    }
  }

  /**
   * Check if current macOS version meets minimum requirement
   * @param {number} minMajor - Minimum major version
   * @param {number} minMinor - Minimum minor version (default: 0)
   * @returns {Promise<boolean>}
   */
  async meetsMinimumVersion(minMajor, minMinor = 0) {
    const cacheKey = `${minMajor}.${minMinor}`;
    if (this.cachedChecks.has(cacheKey)) {
      return this.cachedChecks.get(cacheKey);
    }

    try {
      const version = await this.getMacOSVersion();
      const meets = version.major > minMajor || 
                   (version.major === minMajor && version.minor >= minMinor);
      
      this.cachedChecks.set(cacheKey, meets);
      return meets;
    } catch (error) {
      console.error('Failed to check minimum version:', error);
      return false;
    }
  }

  /**
   * Check if Apple Foundation Models are supported
   * Requires macOS 15.0+ (Sequoia)
   */
  async supportsAppleFoundationModels() {
    if (os.platform() !== 'darwin') {
      return {
        supported: false,
        reason: 'Not running on macOS'
      };
    }

    try {
      const version = await this.getMacOSVersion();
      
      // Check for macOS 15.0+ (Sequoia)
      if (version.major < 15) {
        return {
          supported: false,
          reason: `Apple Foundation Models require macOS 15.0 or later. Current version: ${version.versionString}`,
          currentVersion: version.versionString,
          requiredVersion: '15.0'
        };
      }

      // Check for Apple Silicon
      const { stdout: archOutput } = await execAsync('uname -m');
      const isAppleSilicon = archOutput.trim() === 'arm64';
      
      if (!isAppleSilicon) {
        return {
          supported: false,
          reason: 'Apple Foundation Models require Apple Silicon (M1 or later)',
          currentVersion: version.versionString,
          architecture: archOutput.trim()
        };
      }

      return {
        supported: true,
        currentVersion: version.versionString,
        architecture: 'arm64'
      };
    } catch (error) {
      console.error('Failed to check Apple Foundation Models support:', error);
      return {
        supported: false,
        reason: 'Failed to check system requirements',
        error: error.message
      };
    }
  }

  /**
   * Check if Core ML is available
   * Requires macOS 10.13+ (High Sierra)
   */
  async supportsCoreML() {
    if (os.platform() !== 'darwin') {
      return false;
    }

    try {
      return await this.meetsMinimumVersion(10, 13);
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if Create ML is available
   * Requires macOS 10.14+ (Mojave)
   */
  async supportsCreateML() {
    if (os.platform() !== 'darwin') {
      return false;
    }

    try {
      return await this.meetsMinimumVersion(10, 14);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get detailed system information
   */
  async getSystemInfo() {
    const info = {
      platform: os.platform(),
      arch: os.arch(),
      osRelease: os.release()
    };

    if (os.platform() === 'darwin') {
      try {
        const version = await this.getMacOSVersion();
        info.macOSVersion = version;

        // Get hardware info
        const { stdout: hwModel } = await execAsync('sysctl -n hw.model');
        info.hardwareModel = hwModel.trim();

        // Get chip info for Apple Silicon
        if (os.arch() === 'arm64') {
          try {
            const { stdout: chipInfo } = await execAsync('sysctl -n machdep.cpu.brand_string');
            info.chipInfo = chipInfo.trim();
          } catch (e) {
            // Fallback for older systems
            info.chipInfo = 'Apple Silicon';
          }
        }
      } catch (error) {
        console.error('Failed to get detailed system info:', error);
      }
    }

    return info;
  }
}

// Export singleton instance
module.exports = new OSVersionCheck();