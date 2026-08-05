# Máy chủ AI cục bộ cho APP Tạo Giáo Án.
#
# Làm hai việc:
#   1. Phục vụ chính app (index.html, css/, js/) như một trang web bình thường.
#   2. Nhận POST /api/generate từ app, gọi "claude -p" (Claude Code CLI) ngay
#      trên máy này để soạn giáo án hoặc thực hiện việc "Nhờ AI chỉnh sửa"
#      bằng mô hình thật, rồi trả JSON về cho trình duyệt.
#
# Không cần API key riêng — dùng đúng phiên đăng nhập Claude Code đã có sẵn
# trên máy (đăng nhập bằng `claude` một lần là dùng được). Xem README mục
# "Chạy với AI thật" để biết cách cài Claude Code CLI nếu máy chưa có.
#
# Chạy: bấm đúp chay-voi-ai.bat, hoặc gõ:
#   powershell -ExecutionPolicy Bypass -File ai-server.ps1
# rồi mở http://localhost:8787/ — KHÔNG mở bằng cách bấm đúp index.html nữa,
# vì lúc đó app không gọi được /api/generate (không có máy chủ đứng sau).

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$port = 8787
$maxBudgetUsd = 2.5
$timeoutMs = 240000  # 4 phút — giáo án đầy đủ 6 hoạt động từng mất khoảng 2 phút khi kiểm thử.

# ── Tìm claude.exe ──────────────────────────────────────────────────────────

function Find-ClaudeExe {
  $cmd = Get-Command claude -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $candidate = Join-Path $env:USERPROFILE '.local\bin\claude.exe'
  if (Test-Path $candidate) { return $candidate }
  return $null
}

$claudeExe = Find-ClaudeExe
if (-not $claudeExe) {
  Write-Output 'KHONG TIM THAY claude.exe. Cai Claude Code CLI va dang nhap mot lan (`claude`) roi chay lai script nay.'
  Write-Output 'App van mo duoc va dung binh thuong, chi la khong co AI that - xem README.'
} else {
  Write-Output ('Da tim thay Claude Code CLI: ' + $claudeExe)
}

# Thư mục làm việc riêng cho tiến trình claude.exe, để nó không tình cờ đọc
# CLAUDE.md hay ngữ cảnh của một dự án khác trên máy.
$aiCwd = Join-Path $root '.ai-cwd'
New-Item -ItemType Directory -Force -Path $aiCwd | Out-Null

# ── Gọi claude -p an toàn, không phụ thuộc cách PowerShell tự quote tham số ─

function ConvertTo-Win32Arg {
  param([string]$Arg)
  if ($Arg -eq '') { return '""' }
  if ($Arg -notmatch '[\s"]') { return $Arg }
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.Append('"')
  $i = 0
  $len = $Arg.Length
  while ($i -lt $len) {
    $backslashes = 0
    while ($i -lt $len -and $Arg[$i] -eq '\') { $backslashes++; $i++ }
    if ($i -eq $len) {
      [void]$sb.Append('\' * ($backslashes * 2))
      break
    } elseif ($Arg[$i] -eq '"') {
      [void]$sb.Append('\' * ($backslashes * 2 + 1))
      [void]$sb.Append('"')
      $i++
    } else {
      [void]$sb.Append('\' * $backslashes)
      [void]$sb.Append($Arg[$i])
      $i++
    }
  }
  [void]$sb.Append('"')
  return $sb.ToString()
}

<#
  Gọi claude.exe ở chế độ in kết quả rồi thoát (-p), tắt hết công cụ
  (--tools "") để tiến trình chỉ có thể trả chữ, không đọc/ghi file hay chạy
  lệnh — quan trọng vì nội dung trong prompt có thể chứa chữ giáo viên tự
  gõ. Trả về @{ ok; text; costUsd } hoặc @{ ok = $false; error }.
#>
function Invoke-ClaudePrint {
  param(
    [Parameter(Mandatory)] [string]$Prompt,
    [string]$JsonSchema
  )
  if (-not $claudeExe) {
    return @{ ok = $false; error = 'Chưa cài Claude Code CLI trên máy này (không thấy claude.exe).' }
  }

  $argList = @(
    '-p', '--output-format', 'json', '--no-session-persistence',
    '--disable-slash-commands', '--strict-mcp-config', '--tools', '',
    '--model', 'sonnet', '--max-budget-usd', "$maxBudgetUsd"
  )
  if ($JsonSchema) { $argList += @('--json-schema', $JsonSchema) }
  $cmdLine = ($argList | ForEach-Object { ConvertTo-Win32Arg $_ }) -join ' '

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $claudeExe
  $psi.Arguments = $cmdLine
  $psi.WorkingDirectory = $aiCwd
  $psi.RedirectStandardInput = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
  $psi.StandardErrorEncoding = [System.Text.Encoding]::UTF8
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true

  try {
    $proc = [System.Diagnostics.Process]::Start($psi)
  } catch {
    return @{ ok = $false; error = 'Không chạy được claude.exe: ' + $_.Exception.Message }
  }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  $stdinBytes = $utf8NoBom.GetBytes($Prompt)
  $proc.StandardInput.BaseStream.Write($stdinBytes, 0, $stdinBytes.Length)
  $proc.StandardInput.BaseStream.Flush()
  $proc.StandardInput.Close()

  $stdoutTask = $proc.StandardOutput.ReadToEndAsync()
  $stderrTask = $proc.StandardError.ReadToEndAsync()
  $exited = $proc.WaitForExit($timeoutMs)
  if (-not $exited) {
    try { $proc.Kill($true) } catch {}
    return @{ ok = $false; error = 'Hết thời gian chờ AI (quá ' + [Math]::Round($timeoutMs / 1000) + ' giây).' }
  }

  $stdout = $stdoutTask.GetAwaiter().GetResult()
  $stderr = $stderrTask.GetAwaiter().GetResult()

  if ($proc.ExitCode -ne 0) {
    $msg = ($stderr + ' ' + $stdout).Trim()
    if ($msg.Length -gt 400) { $msg = $msg.Substring(0, 400) }
    return @{ ok = $false; error = 'claude.exe thoát với mã ' + $proc.ExitCode + ': ' + $msg }
  }

  try {
    $parsed = $stdout | ConvertFrom-Json
  } catch {
    return @{ ok = $false; error = 'Không đọc được kết quả từ claude.exe.' }
  }
  if ($parsed.is_error) {
    return @{ ok = $false; error = 'claude báo lỗi: ' + $parsed.result }
  }
  return @{ ok = $true; text = $parsed.result; costUsd = $parsed.total_cost_usd }
}

# ── Máy chủ HTTP ─────────────────────────────────────────────────────────────

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
try {
  $listener.Start()
} catch {
  Write-Output ('Khong mo duoc cong ' + $port + ': ' + $_.Exception.Message)
  Write-Output 'Co the cong dang duoc dung boi chuong trinh khac. Dong chuong trinh do roi chay lai.'
  exit 1
}

Write-Output ''
Write-Output ('APP Tao Giao An - may chu AI cuc bo dang chay tai http://localhost:' + $port + '/')
Write-Output 'Mo dia chi tren bang trinh duyet (Chrome hoac Edge). Dong cua so nay de tat may chu.'
Write-Output ''

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.ico'  = 'image/x-icon'
}

function Write-JsonResponse {
  param($Context, $Object, [int]$StatusCode = 200)
  $json = $Object | ConvertTo-Json -Depth 20 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $Context.Response.StatusCode = $StatusCode
  $Context.Response.ContentType = 'application/json; charset=utf-8'
  $Context.Response.ContentLength64 = $bytes.Length
  $Context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $Context.Response.Close()
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $path = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)

    if ($req.HttpMethod -eq 'GET' -and $path -eq '/api/health') {
      Write-JsonResponse $ctx @{ ok = [bool]$claudeExe; claude = [bool]$claudeExe }
      continue
    }

    if ($req.HttpMethod -eq 'POST' -and $path -eq '/api/generate') {
      $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
      $bodyText = $reader.ReadToEnd()
      $reader.Close()
      try {
        $body = $bodyText | ConvertFrom-Json
      } catch {
        Write-JsonResponse $ctx @{ ok = $false; error = 'Yêu cầu không phải JSON hợp lệ.' } 400
        continue
      }
      if (-not $body.prompt) {
        Write-JsonResponse $ctx @{ ok = $false; error = 'Thiếu "prompt".' } 400
        continue
      }
      $schemaJson = $null
      if ($body.schema) { $schemaJson = $body.schema | ConvertTo-Json -Compress -Depth 20 }

      Write-Output ('[' + (Get-Date -Format 'HH:mm:ss') + '] dang goi AI...')
      $result = Invoke-ClaudePrint -Prompt $body.prompt -JsonSchema $schemaJson
      if ($result.ok) {
        Write-Output ('[' + (Get-Date -Format 'HH:mm:ss') + '] xong, chi phi ~$' + $result.costUsd)
      } else {
        Write-Output ('[' + (Get-Date -Format 'HH:mm:ss') + '] loi: ' + $result.error)
      }
      Write-JsonResponse $ctx $result
      continue
    }

    # Phục vụ file tĩnh cho mọi đường dẫn còn lại.
    $rel = $path.TrimStart('/')
    if ($rel -eq '') { $rel = 'index.html' }
    $filePath = Join-Path $root $rel
    $fullFile = [System.IO.Path]::GetFullPath($filePath)
    $fullRoot = [System.IO.Path]::GetFullPath($root)
    if ($fullFile.StartsWith($fullRoot) -and (Test-Path -LiteralPath $fullFile -PathType Leaf)) {
      $ext = [System.IO.Path]::GetExtension($fullFile).ToLower()
      $ctype = $mime[$ext]
      if (-not $ctype) { $ctype = 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($fullFile)
      $ctx.Response.ContentType = $ctype
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      $ctx.Response.Close()
    } else {
      $ctx.Response.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes('404: ' + $rel)
      $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
      $ctx.Response.Close()
    }
  } catch {
    Write-Output ('Loi khong mong doi: ' + $_.Exception.Message)
  }
}
