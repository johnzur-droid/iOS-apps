' ============================================================================
' THE ZUR PROTOCOL MANUSCRIPT NAVIGATION REPAIR
' ============================================================================
'
' INSTALLATION:
' 1. Open your Word document
' 2. Press Alt+F11 to open Visual Basic Editor
' 3. Insert > Module
' 4. Paste this entire code
' 5. Close VBA Editor (Alt+Q)
' 6. Press Alt+F8, select "RepairManuscriptNavigation", click Run
'
' WHAT IT DOES:
' - REQ-1: Removes poisoned Google hyperlinks from #XXX (Related Topics)
' - REQ-2: Creates ITEM_XXX bookmarks for item headers (001 | or ### 001 |)
' - REQ-3: Links #XXX text to internal ITEM_XXX bookmarks
' - REQ-4: Links all 🔝 emojis to TOC bookmark
'
' ============================================================================

Option Explicit

' Counters for summary report
Private linksRemoved As Long
Private linksPreserved As Long
Private bookmarksCreated As Long
Private internalLinksCreated As Long
Private topLinksCreated As Long

' ============================================================================
' MAIN ENTRY POINT - Run this macro
' ============================================================================
Public Sub RepairManuscriptNavigation()

    ' Initialize counters
    linksRemoved = 0
    linksPreserved = 0
    bookmarksCreated = 0
    internalLinksCreated = 0
    topLinksCreated = 0

    ' Disable screen updating for performance
    Application.ScreenUpdating = False

    On Error GoTo ErrorHandler

    MsgBox "Starting Manuscript Navigation Repair..." & vbCrLf & vbCrLf & _
           "This will:" & vbCrLf & _
           "1. Create bookmarks for item headers" & vbCrLf & _
           "2. Remove poisoned hyperlinks from #XXX" & vbCrLf & _
           "3. Create internal links for #XXX references" & vbCrLf & _
           "4. Link all " & ChrW(128285) & " to document top", _
           vbInformation, "Zur Protocol Repair"

    ' REQ-2: Create bookmarks FIRST (must exist before linking)
    Call CreateItemBookmarks
    Call CreateTOCBookmark

    ' REQ-1: Sanitize poisoned hyperlinks
    Call SanitizePoisonedHyperlinks

    ' REQ-3: Create internal cross-links
    Call CreateInternalCrossLinks

    ' REQ-4: Link top emoji to TOC
    Call LinkTopEmoji

    ' Re-enable screen updating
    Application.ScreenUpdating = True

    ' Show summary
    Call ShowSummary

    Exit Sub

ErrorHandler:
    Application.ScreenUpdating = True
    MsgBox "Error: " & Err.Description, vbCritical, "Repair Failed"

End Sub

' ============================================================================
' REQ-2: ANCHOR CREATION - Create ITEM_XXX bookmarks for headers
' ============================================================================
Private Sub CreateItemBookmarks()

    Dim para As Paragraph
    Dim paraText As String
    Dim itemID As String
    Dim bookmarkName As String
    Dim rng As Range

    For Each para In ActiveDocument.Paragraphs
        paraText = Trim(para.Range.Text)

        ' Remove paragraph mark for matching
        If Right(paraText, 1) = Chr(13) Then
            paraText = Left(paraText, Len(paraText) - 1)
        End If

        ' Check for pattern: "001 |" or "### 001 |"
        itemID = ExtractItemID(paraText)

        If itemID <> "" Then
            bookmarkName = "ITEM_" & itemID

            ' Check if bookmark already exists
            If Not BookmarkExists(bookmarkName) Then
                ' Create bookmark covering the paragraph
                Set rng = para.Range
                ' Exclude paragraph mark from bookmark
                rng.End = rng.End - 1

                ActiveDocument.Bookmarks.Add Name:=bookmarkName, Range:=rng
                bookmarksCreated = bookmarksCreated + 1
            End If
        End If
    Next para

End Sub

' ============================================================================
' REQ-2b: Create TOC bookmark at document start
' ============================================================================
Private Sub CreateTOCBookmark()

    Dim rng As Range

    If Not BookmarkExists("TOC") Then
        ' Create bookmark at the very start of the document
        Set rng = ActiveDocument.Paragraphs(1).Range
        rng.End = rng.End - 1

        ActiveDocument.Bookmarks.Add Name:="TOC", Range:=rng
        bookmarksCreated = bookmarksCreated + 1
    End If

End Sub

' ============================================================================
' REQ-1: SELECTIVE SANITIZATION - Remove #XXX hyperlinks, keep Search: links
' ============================================================================
Private Sub SanitizePoisonedHyperlinks()

    Dim hl As Hyperlink
    Dim hlText As String
    Dim i As Long

    ' Must iterate backwards when deleting from collection
    For i = ActiveDocument.Hyperlinks.Count To 1 Step -1
        Set hl = ActiveDocument.Hyperlinks(i)

        ' Get the visible text of the hyperlink
        hlText = Trim(hl.TextToDisplay)

        ' Check if it's a Related Topic (#XXX pattern)
        If IsRelatedTopicPattern(hlText) Then
            ' Remove the hyperlink but keep the text
            hl.Delete
            linksRemoved = linksRemoved + 1

        ' Check if it's a Technical Source (Search: pattern)
        ElseIf IsSearchPattern(hlText) Then
            ' Preserve - do nothing
            linksPreserved = linksPreserved + 1
        End If
    Next i

End Sub

' ============================================================================
' REQ-3: INTERNAL CROSS-LINKING - Link #XXX text to ITEM_XXX bookmarks
' ============================================================================
Private Sub CreateInternalCrossLinks()

    Dim rng As Range
    Dim foundRange As Range
    Dim itemID As String
    Dim bookmarkName As String
    Dim searchPattern As String

    ' Search for #XXX patterns (# followed by exactly 3 digits)
    ' We need to find each one and link it

    Set rng = ActiveDocument.Content

    With rng.Find
        .ClearFormatting
        .Text = "\#[0-9]{3}"
        .MatchWildcards = True
        .Forward = True
        .Wrap = wdFindStop

        Do While .Execute
            ' Check if this range is NOT already a hyperlink
            If rng.Hyperlinks.Count = 0 Then
                ' Extract the item ID (remove the #)
                itemID = Mid(rng.Text, 2, 3)
                bookmarkName = "ITEM_" & itemID

                ' Only link if the bookmark exists
                If BookmarkExists(bookmarkName) Then
                    ' Create internal hyperlink
                    ActiveDocument.Hyperlinks.Add _
                        Anchor:=rng, _
                        Address:="", _
                        SubAddress:=bookmarkName, _
                        TextToDisplay:=rng.Text

                    internalLinksCreated = internalLinksCreated + 1
                End If
            End If

            ' Move past the found text to continue searching
            rng.Collapse Direction:=wdCollapseEnd
        Loop
    End With

End Sub

' ============================================================================
' REQ-4: GLOBAL NAVIGATION - Link 🔝 emoji to TOC
' ============================================================================
Private Sub LinkTopEmoji()

    Dim rng As Range
    Dim topEmoji As String

    ' The "TOP" emoji (🔝) - Unicode U+1F51D
    topEmoji = ChrW(&HD83D) & ChrW(&HDD1D)

    ' Also try the simpler search in case encoding differs
    Set rng = ActiveDocument.Content

    With rng.Find
        .ClearFormatting
        .Text = topEmoji
        .MatchWildcards = False
        .Forward = True
        .Wrap = wdFindStop

        Do While .Execute
            ' Check if not already a hyperlink
            If rng.Hyperlinks.Count = 0 Then
                ' Check if TOC bookmark exists
                If BookmarkExists("TOC") Then
                    ActiveDocument.Hyperlinks.Add _
                        Anchor:=rng, _
                        Address:="", _
                        SubAddress:="TOC", _
                        TextToDisplay:=rng.Text

                    topLinksCreated = topLinksCreated + 1
                End If
            End If

            rng.Collapse Direction:=wdCollapseEnd
        Loop
    End With

End Sub

' ============================================================================
' HELPER FUNCTIONS
' ============================================================================

' Extract 3-digit item ID from header text
' Matches: "001 |" or "### 001 |" at start of text
Private Function ExtractItemID(ByVal text As String) As String

    Dim i As Long
    Dim startPos As Long
    Dim char As String

    ExtractItemID = ""
    text = Trim(text)

    ' Skip leading ### if present
    If Left(text, 3) = "###" Then
        text = Trim(Mid(text, 4))
    End If

    ' Check if starts with 3 digits followed by space and pipe
    If Len(text) >= 5 Then
        ' Check first 3 characters are digits
        If IsNumeric(Left(text, 3)) Then
            ' Check for " |" after the digits
            If Mid(text, 4, 2) = " |" Then
                ExtractItemID = Left(text, 3)
            End If
        End If
    End If

End Function

' Check if text matches #XXX pattern (hashtag + exactly 3 digits)
Private Function IsRelatedTopicPattern(ByVal text As String) As Boolean

    text = Trim(text)

    If Len(text) = 4 Then
        If Left(text, 1) = "#" Then
            If IsNumeric(Mid(text, 2, 3)) Then
                IsRelatedTopicPattern = True
                Exit Function
            End If
        End If
    End If

    IsRelatedTopicPattern = False

End Function

' Check if text starts with "Search:"
Private Function IsSearchPattern(ByVal text As String) As Boolean

    text = Trim(text)

    If Len(text) >= 7 Then
        If LCase(Left(text, 7)) = "search:" Then
            IsSearchPattern = True
            Exit Function
        End If
    End If

    IsSearchPattern = False

End Function

' Check if a bookmark exists in the document
Private Function BookmarkExists(ByVal bookmarkName As String) As Boolean

    Dim bm As Bookmark

    On Error Resume Next
    Set bm = ActiveDocument.Bookmarks(bookmarkName)
    On Error GoTo 0

    BookmarkExists = Not (bm Is Nothing)

End Function

' ============================================================================
' SUMMARY REPORT
' ============================================================================
Private Sub ShowSummary()

    Dim msg As String

    msg = "MANUSCRIPT REPAIR COMPLETE" & vbCrLf & vbCrLf
    msg = msg & String(40, "=") & vbCrLf & vbCrLf
    msg = msg & "Bookmarks created:        " & bookmarksCreated & vbCrLf
    msg = msg & "Poisoned links removed:   " & linksRemoved & vbCrLf
    msg = msg & "Search: links preserved:  " & linksPreserved & vbCrLf
    msg = msg & "Internal links created:   " & internalLinksCreated & vbCrLf
    msg = msg & ChrW(128285) & " links to TOC:          " & topLinksCreated & vbCrLf
    msg = msg & vbCrLf & String(40, "=") & vbCrLf & vbCrLf
    msg = msg & "SUCCESS CRITERIA:" & vbCrLf
    msg = msg & "- Click #004 should jump to Item 004" & vbCrLf
    msg = msg & "- Click 'Search:' should open browser" & vbCrLf
    msg = msg & "- No visible URLs in footer"

    MsgBox msg, vbInformation, "Repair Summary"

End Sub

' ============================================================================
' UTILITY: View all bookmarks (for debugging)
' ============================================================================
Public Sub ListAllBookmarks()

    Dim bm As Bookmark
    Dim msg As String
    Dim count As Long

    msg = "BOOKMARKS IN DOCUMENT:" & vbCrLf & vbCrLf
    count = 0

    For Each bm In ActiveDocument.Bookmarks
        count = count + 1
        msg = msg & count & ". " & bm.Name & vbCrLf

        ' Limit display to avoid message box overflow
        If count >= 30 Then
            msg = msg & "... and " & (ActiveDocument.Bookmarks.Count - 30) & " more"
            Exit For
        End If
    Next bm

    If count = 0 Then
        msg = msg & "(No bookmarks found)"
    End If

    MsgBox msg, vbInformation, "Bookmark List"

End Sub

' ============================================================================
' UTILITY: View all hyperlinks (for debugging)
' ============================================================================
Public Sub ListAllHyperlinks()

    Dim hl As Hyperlink
    Dim msg As String
    Dim count As Long

    msg = "HYPERLINKS IN DOCUMENT:" & vbCrLf & vbCrLf
    count = 0

    For Each hl In ActiveDocument.Hyperlinks
        count = count + 1
        msg = msg & count & ". [" & hl.TextToDisplay & "]"

        If hl.SubAddress <> "" Then
            msg = msg & " -> #" & hl.SubAddress & " (internal)"
        ElseIf hl.Address <> "" Then
            msg = msg & " -> " & Left(hl.Address, 30)
            If Len(hl.Address) > 30 Then msg = msg & "..."
        End If

        msg = msg & vbCrLf

        ' Limit display
        If count >= 20 Then
            msg = msg & "... and " & (ActiveDocument.Hyperlinks.Count - 20) & " more"
            Exit For
        End If
    Next hl

    If count = 0 Then
        msg = msg & "(No hyperlinks found)"
    End If

    MsgBox msg, vbInformation, "Hyperlink List"

End Sub

' ============================================================================
' UTILITY: Remove ALL bookmarks (use with caution!)
' ============================================================================
Public Sub RemoveAllItemBookmarks()

    Dim bm As Bookmark
    Dim i As Long
    Dim count As Long

    If MsgBox("This will remove ALL ITEM_XXX bookmarks. Continue?", _
              vbYesNo + vbExclamation, "Confirm Delete") = vbNo Then
        Exit Sub
    End If

    count = 0
    For i = ActiveDocument.Bookmarks.Count To 1 Step -1
        Set bm = ActiveDocument.Bookmarks(i)
        If Left(bm.Name, 5) = "ITEM_" Or bm.Name = "TOC" Then
            bm.Delete
            count = count + 1
        End If
    Next i

    MsgBox "Removed " & count & " bookmarks.", vbInformation, "Complete"

End Sub
