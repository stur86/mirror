use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

pub struct AppState {
    pub is_dirty: Mutex<bool>,
    pub is_force_close: Mutex<bool>,
}

#[tauri::command]
fn set_dirty(state: State<'_, AppState>, is_dirty: bool) {
    *state.is_dirty.lock().unwrap() = is_dirty;
}

#[tauri::command]
fn close_window(app: AppHandle) -> Result<(), String> {
    app.get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?
        .close()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn confirm_close(state: State<'_, AppState>, app: AppHandle) -> Result<(), String> {
    *state.is_force_close.lock().unwrap() = true;
    app.get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?
        .close()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_fullscreen(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    let next = !window.is_fullscreen().map_err(|e| e.to_string())?;
    window.set_fullscreen(next).map_err(|e| e.to_string())?;
    window
        .emit("mirror:fullscreen-changed", next)
        .map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
struct DirEntry {
    name: String,
    #[serde(rename = "isDirectory")]
    is_directory: bool,
}

#[derive(serde::Serialize)]
#[serde(untagged)]
enum ListResult {
    Ok { entries: Vec<DirEntry> },
    Err { error: String },
}

#[tauri::command]
fn list_directory(dir_path: String) -> ListResult {
    match std::fs::read_dir(&dir_path) {
        Err(e) => ListResult::Err { error: e.to_string() },
        Ok(rd) => {
            let mut entries: Vec<DirEntry> = rd
                .filter_map(|e| e.ok())
                .filter(|e| !e.file_name().to_string_lossy().starts_with('.'))
                .map(|e| DirEntry {
                    name: e.file_name().to_string_lossy().into_owned(),
                    is_directory: e.file_type().map(|ft| ft.is_dir()).unwrap_or(false),
                })
                .collect();
            entries.sort_by(|a, b| match (a.is_directory, b.is_directory) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
            });
            ListResult::Ok { entries }
        }
    }
}

#[derive(serde::Serialize)]
struct StandardPaths {
    home: String,
    desktop: String,
    documents: String,
    downloads: String,
}

#[tauri::command]
fn get_standard_paths(app: AppHandle) -> StandardPaths {
    let p = app.path();
    let to_s = |r: Result<std::path::PathBuf, _>| r.unwrap_or_default().to_string_lossy().into_owned();
    StandardPaths {
        home: to_s(p.home_dir()),
        desktop: to_s(p.desktop_dir()),
        documents: to_s(p.document_dir()),
        downloads: to_s(p.download_dir()),
    }
}

#[derive(serde::Serialize)]
struct OkResult {
    ok: bool,
}

#[tauri::command]
fn create_directory(dir_path: String) -> OkResult {
    OkResult { ok: std::fs::create_dir_all(&dir_path).is_ok() }
}

#[derive(serde::Serialize)]
#[serde(untagged)]
enum ReadResult {
    Ok { base64: String },
    Err { error: String },
}

#[tauri::command]
fn read_file(file_path: String) -> ReadResult {
    use base64::Engine;
    match std::fs::read(&file_path) {
        Err(e) => ReadResult::Err { error: e.to_string() },
        Ok(bytes) => ReadResult::Ok {
            base64: base64::engine::general_purpose::STANDARD.encode(&bytes),
        },
    }
}

#[tauri::command]
fn save_text_file_at(file_path: String, content: String) -> Result<(), String> {
    std::fs::write(&file_path, content.as_bytes()).map_err(|e| e.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            is_dirty: Mutex::new(false),
            is_force_close: Mutex::new(false),
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let app = window.app_handle();
                let state = app.state::<AppState>();
                let is_dirty = *state.is_dirty.lock().unwrap();
                let is_force_close = *state.is_force_close.lock().unwrap();
                if !is_force_close && is_dirty {
                    api.prevent_close();
                    let _ = app.emit("mirror:close-requested", ());
                } else {
                    *state.is_force_close.lock().unwrap() = false;
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            set_dirty,
            close_window,
            confirm_close,
            toggle_fullscreen,
            list_directory,
            get_standard_paths,
            create_directory,
            read_file,
            save_text_file_at,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
