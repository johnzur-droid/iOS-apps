import ui
import pandas as pd
import io
import html
import re
import os
from urllib.parse import urlparse, unquote
from dropbox import Dropbox
from objc_util import UIApplication, nsurl
import clipboard

APP_KEY = "60xmpweobyc2sji"
APP_SECRET = "qbj8onsfmvguibi"
REFRESH_TOKEN = "_f12xNr44GEAAAAAAAAAAZdyN4wkqCMZdxUIBXIdWN1HF3fVD2vUaj6We50vFLOS"
DROPBOX_FILE_PATH = "/SPRINGSTEEN/BLU-RAYS/concerts_data.csv"

def open_url_in_default_player(url):
    try:
        if url and not re.match(r'^[a-zA-Z][a-zA-Z0-9+\-.]*://', url):
            url = 'http://' + url
        app = UIApplication.sharedApplication()
        ns_url = nsurl(url)
        app.openURL_(ns_url)
    except Exception as e:
        print("open_url_in_default_player error:", e)

def copy_url_button_action(button, url):
    try:
        clipboard.set(url)
        original = button.title
        button.title = "Copied!"
        def restore():
            button.title = original
        ui.delay(restore, 1.2)
    except Exception as e:
        print("copy_url error:", e)
        parent = getattr(button, 'superview', None)
        if parent:
            lbl = ui.Label(frame=(0, parent.height - 60, parent.width, 36))
            lbl.text = "Copy failed"
            lbl.alignment = ui.ALIGN_CENTER
            lbl.background_color = (1, 0.9, 0.6)
            parent.add_subview(lbl)
            ui.delay(lambda: lbl.remove_from_superview(), 1.2)

def format_setlist(raw_songs):
    if not raw_songs:
        return ""
    fully_unescaped = html.unescape(raw_songs)
    parts = re.split(r'[;\n,]+', fully_unescaped)
    cleaned = [p.strip() for p in parts if p.strip()]
    numbered = [f"{i+1}. {song}" for i, song in enumerate(cleaned)]
    return "\n".join(numbered)

def make_open_url_callback(url):
    def callback(sender):
        open_url_in_default_player(url)
    return callback

def make_copy_url_callback(url):
    def callback(sender):
        copy_url_button_action(sender, url)
    return callback

class ConcertSearchApp(ui.View):
    def __init__(self):
        super().__init__(frame=(0, 0, ui.get_screen_size()[0], ui.get_screen_size()[1]))
        self.background_color = 'white'
        self.data = pd.DataFrame()
        self.filtered = pd.DataFrame()
        self.entries = {}
        self.concert_date_col = 'concert date'
        self.current_detail_view = None
        self.load_data()
        self.setup_ui()

    def load_data(self):
        try:
            dbx = Dropbox(oauth2_refresh_token=REFRESH_TOKEN, app_key=APP_KEY, app_secret=APP_SECRET)
            metadata, res = dbx.files_download(DROPBOX_FILE_PATH)
            self.data = pd.read_csv(io.BytesIO(res.content),
                                    engine='python',
                                    encoding='utf-8-sig',
                                    keep_default_na=False,
                                    on_bad_lines='skip')
            self.data.columns = [col.lower().strip() for col in self.data.columns]
            self.data = self.data.fillna('')
            if 'notes' not in self.data.columns:
                self.data['notes'] = ''
        except Exception as e:
            print("CSV Load Error:", e)

    def add_label_and_field(self, field, x, y, label_w, field_w, field_h):
        lbl = ui.Label(frame=(x, y, label_w, field_h))
        lbl.text = field.capitalize() + ":"
        if field.lower() == 'concert date':
            lbl.text = "Date:"
        lbl.alignment = ui.ALIGN_RIGHT
        lbl.font = ('<system>', 16)
        self.add_subview(lbl)
        tf = ui.TextField(frame=(x + label_w + 5, y, field_w, field_h))
        tf.border_width = 1
        tf.corner_radius = 5
        tf.border_color = 'gray'
        tf.clear_button_mode = 'while_editing'
        tf.flex = 'W'
        self.add_subview(tf)
        self.entries[field] = tf

    def setup_ui(self):
        w, h = ui.get_screen_size()
        margin = 15
        label_w = 100
        field_w = w - 2 * margin - label_w
        field_h = 40
        row_spacing = 48
        start_y = 20

        title = ui.Label(frame=(0, start_y - 6, w, 40))
        title.text = "Concert Search"
        title.font = ('<system>', 22)
        title.alignment = ui.ALIGN_CENTER
        title.text_color = 'black'
        title.flex = 'W'
        self.add_subview(title)

        fields = ['songs', 'city', 'state', 'concert date', 'country']
        for i, field in enumerate(fields):
            y = start_y + 40 + i * row_spacing
            self.add_label_and_field(field, margin, y, label_w, field_w, field_h)

        buttons_y = start_y + 40 + len(fields) * row_spacing
        btn_w, btn_h, btn_spacing = 100, 44, 20
        x = margin

        btn_search = ui.Button(frame=(x, buttons_y, btn_w, btn_h))
        btn_search.title = "Search"
        btn_search.action = self.perform_search
        self.add_subview(btn_search)

        x += btn_w + btn_spacing
        btn_clear = ui.Button(frame=(x, buttons_y, btn_w, btn_h))
        btn_clear.title = "Clear"
        btn_clear.action = self.clear_search
        self.add_subview(btn_clear)

        x += btn_w + btn_spacing
        btn_show = ui.Button(frame=(x, buttons_y, btn_w, btn_h))
        btn_show.title = "Show All"
        btn_show.action = self.show_all
        self.add_subview(btn_show)

        tv_y = buttons_y + btn_h + margin
        self.tv = ui.TableView(frame=(margin, tv_y, w - 2 * margin, h - tv_y - margin), flex='WH')
        self.tv.row_height = 66
        self.tv.delegate = self
        self.tv.data_source = self
        self.tv.allows_selection = True
        self.add_subview(self.tv)
        self.tv.reload_data()

        self.no_results_label = ui.Label(frame=(margin, tv_y, w - 2 * margin, 50))
        self.no_results_label.text = "No results available"
        self.no_results_label.alignment = ui.ALIGN_CENTER
        self.no_results_label.text_color = 'gray'
        self.no_results_label.font = ('<system>', 20)
        self.no_results_label.hidden = True
        self.add_subview(self.no_results_label)

    def perform_search(self, sender=None):
        crit = {}
        for k, v in self.entries.items():
            t = v.text.strip() if v.text else ''
            if t:
                crit[k] = t
        filtered = self.data.copy()
        for k, val in crit.items():
            col = k.lower()
            if col not in filtered.columns:
                continue
            terms = val.split()
            for term in terms:
                regex = self.wildcard_to_regex(term)
                mask = filtered[col].astype(str).str.contains(regex, case=False, na=False, regex=True)
                filtered = filtered[mask]
        try:
            filtered = filtered[filtered[self.concert_date_col].astype(str).str.strip().astype(bool)]
        except Exception:
            pass
        self.filtered = filtered.reset_index(drop=True)
        self.refresh_results()

    def wildcard_to_regex(self, term):
        return re.escape(term).replace(r'\*', '.*').replace(r'\?', '.')

    def clear_search(self, sender=None):
        for tf in self.entries.values():
            tf.text = ''
        self.filtered = pd.DataFrame()
        self.no_results_label.hidden = True
        self.tv.hidden = False
        self.tv.reload_data()

    def show_all(self, sender=None):
        for tf in self.entries.values():
            tf.text = ''
        filtered = self.data.copy()
        try:
            filtered = filtered[filtered[self.concert_date_col].astype(str).str.strip().astype(bool)]
        except Exception:
            pass

        # Use 'sort_key' column for sorting
        if 'sort_key' in filtered.columns:
            def parse_sort_key(val):
                val_str = str(val).strip()
                if not val_str:
                    return pd.NaT

                # Try standard YYYY-MM-DD parsing first
                try:
                    return pd.to_datetime(val_str, format='%Y-%m-%d', errors='raise')
                except:
                    pass

                # Handle "2024-00-00" - year only, treat as Jan 1
                if re.match(r'^\d{4}-00-00$', val_str):
                    return pd.to_datetime(val_str[:4] + '-01-01')

                # Handle "2024-05-00" - year and month, treat as 1st of month
                if re.match(r'^\d{4}-\d{2}-00$', val_str):
                    return pd.to_datetime(val_str[:7] + '-01')

                return pd.NaT

            filtered['_sort_date'] = filtered['sort_key'].apply(parse_sort_key)
            filtered = filtered.sort_values(by='_sort_date', ascending=False, na_position='last').drop(columns=['_sort_date'])

        self.filtered = filtered.reset_index(drop=True)
        self.refresh_results()

    def refresh_results(self):
        if self.filtered is None or len(self.filtered) == 0:
            self.tv.hidden = True
            self.no_results_label.hidden = False
        else:
            self.tv.hidden = False
            self.no_results_label.hidden = True
            self.tv.reload_data()

    def tableview_number_of_rows(self, tv, section):
        return len(self.filtered) if self.filtered is not None else 0

    def tableview_cell_for_row(self, tv, section, row):
        cell = ui.TableViewCell()
        if self.filtered is None or row >= len(self.filtered):
            return cell
        rd = self.filtered.iloc[row]
        date = rd.get(self.concert_date_col, '')
        city = html.unescape(rd.get('city', ''))
        venue = html.unescape(rd.get('venue', ''))
        cell.text_label.text = f"{date} - {city}"
        cell.text_label.font = ('<system>', 18)
        cell.text_label.number_of_lines = 1
        try:
            subtitle = ui.Label(frame=(15, 36, cell.width - 30, 24))
            subtitle.text = venue
            subtitle.font = ('<system>', 14)
            subtitle.text_color = 'gray'
            subtitle.number_of_lines = 1
            subtitle.alignment = ui.ALIGN_LEFT
            subtitle.flex = 'W'
            cell.content_view.add_subview(subtitle)
        except Exception:
            pass
        return cell

    def tableview_did_select(self, tv, section, row):
        if self.filtered is None or row >= len(self.filtered):
            return
        rd = self.filtered.iloc[row]

        website_url = rd.get('url', '').strip()
        youtube_url = rd.get('youtube url', '').strip()
        dropbox_url = rd.get('watch video', '').strip()
        copy_url = rd.get('copy url', '').strip()

        btns = []
        if website_url and website_url.lower() not in ('', 'nan', 'none'):
            btns.append(('Website', make_open_url_callback(website_url)))
        if youtube_url and youtube_url.lower() not in ('', 'nan', 'none'):
            btns.append(('YouTube', make_open_url_callback(youtube_url)))
        if copy_url and copy_url.lower() not in ('', 'nan', 'none'):
            btns.append(('Copy URL', make_copy_url_callback(copy_url)))
        if dropbox_url and dropbox_url.lower() not in ('', 'nan', 'none'):
            btns.append(('Dropbox', make_open_url_callback(dropbox_url)))

        BUTTON_H = 44
        cols = 2
        spacing = 12
        rows_needed = (len(btns) + (cols - 1)) // cols
        container_h = rows_needed * (BUTTON_H + 8) + 40
        container_y = self.height - container_h - 16
        btn_container = ui.View(frame=(0, container_y, self.width, container_h))
        btn_container.background_color = 'yellow'
        btn_container.flex = 'W'

        detail_view = ui.View(frame=self.bounds)
        detail_view.background_color = 'white'
        detail_view.flex = 'WH'
        self.current_detail_view = detail_view

        header_h = 50
        header = ui.Label(frame=(0, 6, self.width, header_h))
        header.text = "Search Details"
        header.font = ('<system>', 20)
        header.alignment = ui.ALIGN_CENTER
        header.flex = 'W'
        detail_view.add_subview(header)
        detail_view.add_subview(btn_container)

        btn_w = (self.width - spacing * (cols + 1)) // cols

        for idx, (title, action) in enumerate(btns):
            col = idx % cols
            row_idx = idx // cols
            bx = spacing + col * (btn_w + spacing)
            by = 8 + row_idx * (BUTTON_H + 8)
            b = ui.Button(frame=(bx, by, btn_w, BUTTON_H))
            b.title = title
            b.action = action
            b.corner_radius = 6
            b.border_width = 1
            b.border_color = 'gray'
            b.background_color = 'lightblue'
            btn_container.add_subview(b)

        formatted_songs = format_setlist(rd.get('songs', ''))

        detail_text = f"""Artist: {rd.get('artist', '')}
Date: {rd.get('concert date', '')}
City: {rd.get('city', '')}, State: {rd.get('state', '')}
Country: {rd.get('country', '')}
Venue: {rd.get('venue', '')}

Set list:
{formatted_songs}

Notes:
{rd.get('notes', '')}
"""
        textview_height = container_y - 10
        textview = ui.TextView(frame=(10, header_h + 6, self.width - 20, textview_height - header_h - 16))
        textview.text = detail_text
        textview.editable = False
        textview.font = ('<system>', 16)
        textview.flex = 'WH'
        detail_view.add_subview(textview)

        detail_view.present('fullscreen', hide_title_bar=False)

app = ConcertSearchApp()
app.present('fullscreen')
