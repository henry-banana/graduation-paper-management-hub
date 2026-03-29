$Error.Clear()
Add-Type -AssemblyName System.IO.Compression.FileSystem

$files = @(
  'bctt-rubric-template.docx',
  'kltn-gvhd-rubric-template.docx',
  'kltn-gvpb-rubric-template.docx',
  'kltn-council-rubric-template.docx'
)
$baseDir = Join-Path (Get-Location) 'resources\docx-templates'

function Get-DocData {
  param([string]$DocxPath)

  if (-not (Test-Path $DocxPath)) { return $null }

  $zip = [System.IO.Compression.ZipFile]::OpenRead($DocxPath)
  try {
    $entry = $zip.GetEntry('word/document.xml')
    if (-not $entry) { return $null }

    $stream = $entry.Open()
    try {
      $reader = [System.IO.StreamReader]::new($stream)
      try { $xmlText = $reader.ReadToEnd() } finally { $reader.Dispose() }
    } finally {
      $stream.Dispose()
    }
  } finally {
    $zip.Dispose()
  }

  try {
    [xml]$xml = $xmlText
    $ns = [System.Xml.XmlNamespaceManager]::new($xml.NameTable)
    $ns.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
    $textNodes = $xml.SelectNodes('//w:t', $ns)
    $plain = ($textNodes | ForEach-Object { $_.InnerText }) -join ' '
  } catch {
    $plain = [regex]::Replace($xmlText, '<[^>]+>', ' ')
  }

  $plain = [System.Net.WebUtility]::HtmlDecode($plain)
  $plain = [regex]::Replace($plain, '\s+', ' ').Trim()
  return @{ Raw = $xmlText; Plain = $plain }
}

$placeholderPattern = '\{\{[^{}]+\}\}|\$\{[^{}]+\}|<<[^<>]+>>|\[\[[^\[\]]+\]\]|\{%[^%]+%\}'
$blankPatterns = @(
  '_{3,}',
  '\.{3,}',
  '(?i)(Họ\s*và\s*tên|MSSV|Mã\s*số\s*sinh\s*viên|Lớp|Khóa|Tên\s*đề\s*tài|Giảng\s*viên|Giáo\s*viên|Sinh\s*viên|Ngày|Điểm|Nhận\s*xét|Chữ\s*ký|Email|Số\s*điện\s*thoại|Đơn\s*vị|Chức\s*danh)\s*[:\-]'
)

foreach ($file in $files) {
  $fullPath = Join-Path $baseDir $file
  $doc = Get-DocData -DocxPath $fullPath

  Write-Output "TEMPLATE=$file"

  if (-not $doc) {
    Write-Output 'PLACEHOLDER_FOUND=false'
    Write-Output 'BLANK_SNIPPETS:'
    Write-Output '- (file/document.xml not found)'
    Write-Output ''
    continue
  }

  $text = $doc.Plain
  $placeholderFound = [regex]::IsMatch($text, $placeholderPattern)

  $snippets = [System.Collections.Generic.List[string]]::new()
  $seen = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

  foreach ($pattern in $blankPatterns) {
    $matches = [regex]::Matches($text, $pattern, [Text.RegularExpressions.RegexOptions]::IgnoreCase)
    foreach ($m in $matches) {
      $start = [Math]::Max(0, $m.Index - 70)
      $length = [Math]::Min($text.Length - $start, $m.Length + 140)
      $snippet = $text.Substring($start, $length)
      $snippet = [regex]::Replace($snippet, '\s+', ' ').Trim()
      if ($snippet.Length -gt 180) { $snippet = $snippet.Substring(0, 180) + '...' }

      if ($snippet -and $seen.Add($snippet)) {
        [void]$snippets.Add($snippet)
      }

      if ($snippets.Count -ge 20) { break }
    }

    if ($snippets.Count -ge 20) { break }
  }

  Write-Output ("PLACEHOLDER_FOUND=" + ($(if ($placeholderFound) { 'true' } else { 'false' })))
  Write-Output 'BLANK_SNIPPETS:'
  if ($snippets.Count -eq 0) {
    Write-Output '- (none)'
  } else {
    $snippets | Select-Object -First 20 | ForEach-Object { Write-Output "- $_" }
  }
  Write-Output ''
}
