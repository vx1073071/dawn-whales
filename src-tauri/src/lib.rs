use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to QuantDesk Pro.", name)
}

#[tauri::command]
fn get_app_info() -> serde_json::Value {
    serde_json::json!({
        "name": "QuantDesk Pro",
        "version": "0.1.0",
        "broker": "futu",
        "opend_host": "127.0.0.1",
        "opend_port": 11111,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![greet, get_app_info])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
