import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function executePowerShell(command: string): Promise<{ output: string; error?: string }> {
  try {
    // Wrap PowerShell command for Windows
    const psCommand = `powershell -Command "${command.replace(/"/g, '`"')}"`
    
    const { stdout, stderr } = await execAsync(psCommand, {
      encoding: 'utf8',
      timeout: 30000, // 30 second timeout
    })

    return {
      output: stdout,
      error: stderr || undefined,
    }
  } catch (error: any) {
    return {
      output: '',
      error: error.message || 'Unknown error',
    }
  }
}

// Pre-defined system commands
export async function getSystemInfo() {
  return await executePowerShell(`
    Get-ComputerInfo | Select-Object CsName, OsName, OsVersion, TotalPhysicalMemory, @{N='FreeSpace';E={(Get-Volume | Where-Object DriveLetter -eq "C:" | Select-Object SizeRemaining).SizeRemaining}} | ConvertTo-Json
  `)
}

export async function getDiskUsage() {
  return await executePowerShell(`
    Get-Volume | Select-Object DriveLetter, FileSystemLabel, @{N='SizeGB';E={[math]::Round($_.Size/1GB,2)}}, @{N='RemainingGB';E={[math]::Round($_.SizeRemaining/1GB,2)}}, @{N='UsedPercent';E={[math]::Round((1 - $_.SizeRemaining / $_.Size) * 100,2)}} | ConvertTo-Json
  `)
}

export async function getRunningProcesses() {
  return await executePowerShell(`
    Get-Process | Sort-Object CPU -Descending | Select-Object -First 20 Name, @{N='CPU(s)';E={$_.CPU}}, @{N='Memory(MB)';E={[math]::Round($_.WorkingSet/1MB,2)}} | ConvertTo-Json
  `)
}

export async function getNetworkStatus() {
  return await executePowerShell(`
    Get-NetIPConfiguration | Select-Object InterfaceAlias, IPv4Address, IPv6Address, DNS_SERVERS | ConvertTo-Json
  `)
}

export async function disconnectWiFi() {
  return await executePowerShell(`
    $interfaces = Get-NetConnectionProfile -NetworkCategory Private
    foreach ($interface in $interfaces) {
      Disable-NetAdapter -Name $interface.InterfaceAlias -Confirm:$false
    }
    "WiFi disconnected"
  `)
}

export async function connectWiFi(ssid: string, password: string) {
  return await executePowerShell(`
    $profileName = "$ssid-profile"
    netsh wlan add profile filename="<WifiProfile><name>$profileName</name><SSIDConfig><SSID>$ssid</SSID></SSIDConfig><connectionType>ESS</connectionType><MSM><security><authEncryption><authentication>WPA2PSK</authentication><encryption>AES</encryption><useOneX>false</useOneX></authEncryption><sharedKey><keyType>passPhrase</keyType><protected>false</protected><keyMaterial>$password</keyMaterial></sharedKey></security></MSM></WifiProfile>" user=current
    netsh wlan connect name=$profileName
    "Connecting to $ssid..."
  `)
}

export async function restartComputer() {
  return await executePowerShell(`
    Restart-Computer -Force
  `)
}

export async function shutdownComputer() {
  return await executePowerShell(`
    Stop-Computer -Force
  `)
}

export async function getFileTree(path: string = 'C:\\') {
  return await executePowerShell(`
    Get-ChildItem -Path "${path}" -Recurse -Depth 2 -ErrorAction SilentlyContinue | Select-Object FullName, Length, LastWriteTime | ConvertTo-Json
  `)
}
