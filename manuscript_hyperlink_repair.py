#!/usr/bin/env python3
"""
The Zur Protocol Manuscript Navigation Repair Tool
==================================================

This script processes a Word document (.docx) to fix hyperlink navigation:

Object A (Related Topics): #XXX patterns -> Convert to internal bookmarks (ITEM_XXX)
Object B (Technical Sources): "Search:" links -> Preserve as external links
Object C (Item Headers): "001 |" or "### 001 |" -> Create bookmark anchors

Requirements Implemented:
- REQ-1: Selective Sanitization - Strip poisoned hyperlinks from #XXX, preserve Search: links
- REQ-2: Anchor Creation - Create ITEM_XXX bookmarks for item headers
- REQ-3: Internal Cross-Linking - Link #XXX text to internal bookmarks
- REQ-4: Global Navigation - Link 🔝 emoji to TOC bookmark

Usage:
    python manuscript_hyperlink_repair.py <input.docx> [output.docx]

If output is not specified, creates input_repaired.docx
"""

import re
import sys
import copy
from pathlib import Path
from lxml import etree

# python-docx imports
from docx import Document
from docx.shared import Pt
from docx.oxml.ns import qn, nsmap
from docx.oxml import OxmlElement

# XML namespaces for Word documents
WORD_NAMESPACE = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
RELATIONSHIP_NAMESPACE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

# Namespace map for XPath queries
NSMAP = {
    'w': WORD_NAMESPACE,
    'r': RELATIONSHIP_NAMESPACE,
}

# Patterns for object identification
RELATED_TOPIC_PATTERN = re.compile(r'^#(\d{3})$')  # Object A: #019, #150
ITEM_HEADER_PATTERN = re.compile(r'^(?:###\s*)?(\d{3})\s*\|')  # Object C: "001 |" or "### 001 |"
SEARCH_PATTERN = re.compile(r'^Search:', re.IGNORECASE)  # Object B: "Search: AAP Policy"
TOP_EMOJI = '🔝'


class ManuscriptRepair:
    """Main class for repairing manuscript hyperlinks and creating navigation."""

    def __init__(self, input_path: str):
        self.input_path = Path(input_path)
        self.doc = Document(input_path)
        self.bookmarks_created = set()
        self.links_sanitized = 0
        self.links_preserved = 0
        self.internal_links_created = 0
        self.top_links_created = 0

    def run_all_repairs(self) -> None:
        """Execute all repair requirements in order."""
        print("=" * 60)
        print("The Zur Protocol Manuscript Navigation Repair")
        print("=" * 60)

        # REQ-2 must run first to create bookmarks before linking
        print("\n[REQ-2] Creating Anchor Bookmarks...")
        self._create_item_bookmarks()

        # Create TOC bookmark at document start for 🔝 navigation
        print("\n[REQ-2b] Creating TOC Bookmark...")
        self._create_toc_bookmark()

        # REQ-1: Sanitize poisoned hyperlinks
        print("\n[REQ-1] Selective Sanitization...")
        self._sanitize_hyperlinks()

        # REQ-3: Create internal cross-links
        print("\n[REQ-3] Internal Cross-Linking...")
        self._create_internal_links()

        # REQ-4: Link top emoji to TOC
        print("\n[REQ-4] Global Navigation (🔝 → TOC)...")
        self._link_top_emoji()

        self._print_summary()

    def _create_item_bookmarks(self) -> None:
        """
        REQ-2: Create ITEM_XXX bookmarks for item headers.

        Identifies paragraphs starting with "001 |" or "### 001 |" pattern
        and creates bookmarks covering those paragraphs.
        """
        for para in self.doc.paragraphs:
            text = para.text.strip()
            match = ITEM_HEADER_PATTERN.match(text)

            if match:
                item_id = match.group(1)
                bookmark_name = f"ITEM_{item_id}"

                if bookmark_name not in self.bookmarks_created:
                    self._add_bookmark_to_paragraph(para, bookmark_name)
                    self.bookmarks_created.add(bookmark_name)
                    print(f"  ✓ Created bookmark: {bookmark_name}")

    def _create_toc_bookmark(self) -> None:
        """Create a TOC bookmark at the start of the document for 🔝 navigation."""
        if self.doc.paragraphs:
            first_para = self.doc.paragraphs[0]
            self._add_bookmark_to_paragraph(first_para, "TOC")
            self.bookmarks_created.add("TOC")
            print("  ✓ Created bookmark: TOC (at document start)")

    def _add_bookmark_to_paragraph(self, paragraph, bookmark_name: str) -> None:
        """
        Add a bookmark spanning the entire paragraph.

        Creates XML structure:
        <w:bookmarkStart w:id="X" w:name="ITEM_XXX"/>
        ... paragraph content ...
        <w:bookmarkEnd w:id="X"/>
        """
        # Get unique bookmark ID
        bookmark_id = str(len(self.bookmarks_created))

        # Create bookmarkStart element
        bookmark_start = OxmlElement('w:bookmarkStart')
        bookmark_start.set(qn('w:id'), bookmark_id)
        bookmark_start.set(qn('w:name'), bookmark_name)

        # Create bookmarkEnd element
        bookmark_end = OxmlElement('w:bookmarkEnd')
        bookmark_end.set(qn('w:id'), bookmark_id)

        # Insert at beginning of paragraph
        para_xml = paragraph._p
        if len(para_xml) > 0:
            para_xml.insert(0, bookmark_start)
        else:
            para_xml.append(bookmark_start)

        # Append at end of paragraph
        para_xml.append(bookmark_end)

    def _sanitize_hyperlinks(self) -> None:
        """
        REQ-1: Remove hyperlinks from #XXX patterns, preserve Search: links.

        Iterates through all hyperlinks and:
        - Removes URL from #XXX patterns (Related Topics)
        - Preserves Search: links (Technical Sources)
        """
        # Process document body
        self._sanitize_hyperlinks_in_element(self.doc._body._body)

        print(f"  ✓ Sanitized {self.links_sanitized} poisoned hyperlinks")
        print(f"  ✓ Preserved {self.links_preserved} Search: hyperlinks")

    def _sanitize_hyperlinks_in_element(self, element) -> None:
        """Process hyperlinks within an XML element."""
        # Find all hyperlink elements
        hyperlinks = element.findall('.//w:hyperlink', NSMAP)

        for hyperlink in hyperlinks:
            # Get the visible text of the hyperlink
            text_content = self._get_hyperlink_text(hyperlink)

            if RELATED_TOPIC_PATTERN.match(text_content.strip()):
                # This is a Related Topic (#XXX) - remove the hyperlink
                self._remove_hyperlink_preserve_text(hyperlink)
                self.links_sanitized += 1
            elif SEARCH_PATTERN.match(text_content.strip()):
                # This is a Technical Source (Search:) - preserve it
                self.links_preserved += 1

    def _get_hyperlink_text(self, hyperlink_element) -> str:
        """Extract visible text from a hyperlink element."""
        text_parts = []
        for text_elem in hyperlink_element.findall('.//w:t', NSMAP):
            if text_elem.text:
                text_parts.append(text_elem.text)
        return ''.join(text_parts)

    def _remove_hyperlink_preserve_text(self, hyperlink_element) -> None:
        """
        Remove hyperlink functionality but preserve the visible text.

        Replaces <w:hyperlink>...</w:hyperlink> with just the inner run elements.
        """
        parent = hyperlink_element.getparent()
        if parent is None:
            return

        # Get position of hyperlink in parent
        index = list(parent).index(hyperlink_element)

        # Move all child elements (runs) to parent, preserving order
        children = list(hyperlink_element)
        for i, child in enumerate(children):
            parent.insert(index + i, child)

        # Remove the now-empty hyperlink element
        parent.remove(hyperlink_element)

    def _create_internal_links(self) -> None:
        """
        REQ-3: Convert plain #XXX text to internal hyperlinks.

        Searches for text matching #XXX pattern and creates hyperlinks
        to corresponding ITEM_XXX bookmarks.
        """
        for para in self.doc.paragraphs:
            self._process_paragraph_for_links(para)

        print(f"  ✓ Created {self.internal_links_created} internal cross-links")

    def _process_paragraph_for_links(self, paragraph) -> None:
        """Process a paragraph to find and link #XXX references."""
        para_xml = paragraph._p

        # Find all runs in the paragraph
        runs = para_xml.findall('.//w:r', NSMAP)

        for run in runs:
            # Skip runs that are already inside hyperlinks
            if run.getparent().tag == qn('w:hyperlink'):
                continue

            text_elem = run.find('w:t', NSMAP)
            if text_elem is None or text_elem.text is None:
                continue

            text = text_elem.text

            # Check for #XXX pattern
            match = RELATED_TOPIC_PATTERN.search(text)
            if match:
                item_id = match.group(1)
                bookmark_name = f"ITEM_{item_id}"

                # Only create link if bookmark exists
                if bookmark_name in self.bookmarks_created:
                    self._convert_run_to_internal_link(run, text_elem, match, bookmark_name)
                    self.internal_links_created += 1

    def _convert_run_to_internal_link(self, run, text_elem, match, bookmark_name: str) -> None:
        """
        Convert a text run containing #XXX to an internal hyperlink.

        Handles cases where #XXX is part of larger text by splitting the run.
        """
        text = text_elem.text
        full_match = match.group(0)  # e.g., "#019"
        start_pos = match.start()
        end_pos = match.end()

        parent = run.getparent()
        run_index = list(parent).index(run)

        # Get run properties for styling consistency
        rPr = run.find('w:rPr', NSMAP)

        elements_to_insert = []

        # Text before the match
        if start_pos > 0:
            before_run = self._create_run(text[:start_pos], rPr)
            elements_to_insert.append(before_run)

        # The hyperlink with #XXX
        hyperlink = self._create_internal_hyperlink(full_match, bookmark_name, rPr)
        elements_to_insert.append(hyperlink)

        # Text after the match
        if end_pos < len(text):
            after_run = self._create_run(text[end_pos:], rPr)
            elements_to_insert.append(after_run)

        # Insert new elements and remove original run
        for i, elem in enumerate(elements_to_insert):
            parent.insert(run_index + i, elem)

        parent.remove(run)

    def _create_run(self, text: str, rPr=None) -> OxmlElement:
        """Create a new run element with optional formatting."""
        run = OxmlElement('w:r')

        if rPr is not None:
            run.append(copy.deepcopy(rPr))

        text_elem = OxmlElement('w:t')
        text_elem.text = text
        # Preserve spaces
        text_elem.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
        run.append(text_elem)

        return run

    def _create_internal_hyperlink(self, text: str, bookmark_name: str, rPr=None) -> OxmlElement:
        """
        Create an internal hyperlink element pointing to a bookmark.

        Uses w:anchor attribute for internal document links (SubAddress).
        """
        hyperlink = OxmlElement('w:hyperlink')
        hyperlink.set(qn('w:anchor'), bookmark_name)

        # Create the run inside the hyperlink
        run = OxmlElement('w:r')

        # Copy run properties and add hyperlink styling
        new_rPr = OxmlElement('w:rPr')
        if rPr is not None:
            for child in rPr:
                new_rPr.append(copy.deepcopy(child))

        # Add blue color for hyperlink appearance
        color = OxmlElement('w:color')
        color.set(qn('w:val'), '0000FF')
        new_rPr.append(color)

        # Add underline
        underline = OxmlElement('w:u')
        underline.set(qn('w:val'), 'single')
        new_rPr.append(underline)

        run.append(new_rPr)

        # Add the text
        text_elem = OxmlElement('w:t')
        text_elem.text = text
        run.append(text_elem)

        hyperlink.append(run)

        return hyperlink

    def _link_top_emoji(self) -> None:
        """
        REQ-4: Link every 🔝 emoji to the TOC bookmark.
        """
        if "TOC" not in self.bookmarks_created:
            print("  ⚠ TOC bookmark not found, skipping 🔝 linking")
            return

        for para in self.doc.paragraphs:
            self._link_emoji_in_paragraph(para, TOP_EMOJI, "TOC")

        print(f"  ✓ Linked {self.top_links_created} 🔝 emojis to TOC")

    def _link_emoji_in_paragraph(self, paragraph, emoji: str, bookmark_name: str) -> None:
        """Find and link emoji characters to a bookmark."""
        para_xml = paragraph._p
        runs = para_xml.findall('.//w:r', NSMAP)

        for run in runs:
            # Skip runs already in hyperlinks
            if run.getparent().tag == qn('w:hyperlink'):
                continue

            text_elem = run.find('w:t', NSMAP)
            if text_elem is None or text_elem.text is None:
                continue

            if emoji in text_elem.text:
                text = text_elem.text
                rPr = run.find('w:rPr', NSMAP)
                parent = run.getparent()
                run_index = list(parent).index(run)

                elements_to_insert = []
                current_pos = 0

                # Split text around each emoji occurrence
                for i, char in enumerate(text):
                    if char == emoji:
                        # Text before emoji
                        if i > current_pos:
                            before_run = self._create_run(text[current_pos:i], rPr)
                            elements_to_insert.append(before_run)

                        # The emoji as hyperlink
                        hyperlink = self._create_internal_hyperlink(emoji, bookmark_name, rPr)
                        elements_to_insert.append(hyperlink)
                        self.top_links_created += 1
                        current_pos = i + 1

                # Remaining text after last emoji
                if current_pos < len(text):
                    after_run = self._create_run(text[current_pos:], rPr)
                    elements_to_insert.append(after_run)

                # Replace original run with new elements
                for j, elem in enumerate(elements_to_insert):
                    parent.insert(run_index + j, elem)
                parent.remove(run)

    def _print_summary(self) -> None:
        """Print a summary of all repairs made."""
        print("\n" + "=" * 60)
        print("REPAIR SUMMARY")
        print("=" * 60)
        print(f"  Bookmarks created:        {len(self.bookmarks_created)}")
        print(f"  Poisoned links sanitized: {self.links_sanitized}")
        print(f"  Search: links preserved:  {self.links_preserved}")
        print(f"  Internal links created:   {self.internal_links_created}")
        print(f"  🔝 links to TOC:          {self.top_links_created}")
        print("=" * 60)

    def save(self, output_path: str = None) -> str:
        """Save the repaired document."""
        if output_path is None:
            output_path = self.input_path.stem + "_repaired.docx"

        output_path = Path(output_path)
        self.doc.save(output_path)
        print(f"\n✓ Saved repaired document: {output_path}")
        return str(output_path)


def main():
    """Main entry point for command-line usage."""
    if len(sys.argv) < 2:
        print(__doc__)
        print("\nError: Please provide an input document path.")
        print("Usage: python manuscript_hyperlink_repair.py <input.docx> [output.docx]")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else None

    if not Path(input_path).exists():
        print(f"Error: Input file not found: {input_path}")
        sys.exit(1)

    if not input_path.lower().endswith('.docx'):
        print("Error: Input file must be a .docx Word document")
        sys.exit(1)

    try:
        repair = ManuscriptRepair(input_path)
        repair.run_all_repairs()
        repair.save(output_path)
        print("\n✓ Manuscript navigation repair complete!")

    except Exception as e:
        print(f"\nError during repair: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
