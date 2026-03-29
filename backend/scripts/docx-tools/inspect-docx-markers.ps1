Add-Type -AssemblyName System.IO.Compression.FileSystem

$pattern = '(?<dots>\.{5,})|(?<underscores>_{3,})'
$templateDir = Join-Path (Get-Location) 'resources\docx-templates'

Get-ChildItem $templateDir -Filter '*.docx' | Sort-Object Name | ForEach-Object {
    $file = $_
    $xmlText = $null

    $zip = [System.IO.Compression.ZipFile]::OpenRead($file.FullName)
    try {
        $entry = $zip.GetEntry('word/document.xml')
        if ($entry) {
            $stream = $entry.Open()
            try {
                $reader = [System.IO.StreamReader]::new($stream)
                try { $xmlText = $reader.ReadToEnd() } finally { $reader.Dispose() }
            } finally {
                $stream.Dispose()
            }
        }
    } finally {
        $zip.Dispose()
    }

    Write-Output ("Template: {0}" -f $file.Name)

    if (-not $xmlText) {
        Write-Output 'Matches: document.xml not found'
        Write-Output ''
        return
    }

    try {
        [xml]$xml = $xmlText
        $ns = [System.Xml.XmlNamespaceManager]::new($xml.NameTable)
        $ns.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
        $text = (($xml.SelectNodes('//w:t', $ns) | ForEach-Object { $_.InnerText }) -join '')
    } catch {
        $text = [regex]::Replace($xmlText, '<[^>]+>', ' ')
    }

    $text = [System.Net.WebUtility]::HtmlDecode($text)

    $matches = [regex]::Matches($text, $pattern)
    $dotCount = 0
    $underscoreCount = 0
    $snippets = [System.Collections.Generic.List[string]]::new()
    $seen = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

    foreach ($m in $matches) {
        if ($m.Groups['dots'].Success) { $dotCount++ }
        if ($m.Groups['underscores'].Success) { $underscoreCount++ }

        if ($snippets.Count -lt 20) {
            $start = [Math]::Max(0, $m.Index - 50)
            $length = [Math]::Min($text.Length - $start, $m.Length + 100)
            $snippet = $text.Substring($start, $length)
            $snippet = [regex]::Replace($snippet, '\s+', ' ').Trim()
            if ($snippet.Length -gt 180) { $snippet = $snippet.Substring(0, 180) + '...' }
            if ($snippet -and $seen.Add($snippet)) {
                [void]$snippets.Add($snippet)
            }
        }
    }

    Write-Output ("Matches: dots(>=5)={0}; underscores(>=3)={1}; total={2}" -f $dotCount, $underscoreCount, $matches.Count)
    Write-Output 'Snippets (up to 20):'

    if ($snippets.Count -eq 0) {
        Write-Output '- (none)'
    } else {
        $snippets | Select-Object -First 20 | ForEach-Object { Write-Output ("- {0}" -f $_) }
    }

    Write-Output ''
}
