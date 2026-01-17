use rusqlite::{params, Connection, Error};
use std::time::{SystemTime, UNIX_EPOCH};

/// AFK threshold in seconds - if user takes longer than this on a single page, assume AFK
pub const AFK_THRESHOLD_SECONDS: i64 = 300; // 5 minutes

/// Get current Unix timestamp (seconds since epoch)
pub fn unix_now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// Represents a row from the reading_sessions table
#[derive(Debug, Clone)]
pub struct SessionRow {
    pub id: i64,
    pub context: String,
    pub started_at: i64,           // Unix epoch seconds
    pub ended_at: Option<i64>,     // Unix epoch seconds
    pub last_page_at: i64,         // Unix epoch seconds
    pub reading_time_seconds: i64,
    pub pages_viewed: i64,
    pub total_characters: i64,
    pub is_active: bool,
}

/// Find the active session for a given context
fn find_active_session(conn: &Connection, context: &str) -> Result<Option<SessionRow>, Error> {
    let mut stmt = conn.prepare(
        "SELECT id, context, started_at, ended_at, last_page_at, reading_time_seconds,
                pages_viewed, total_characters, is_active
         FROM reading_sessions
         WHERE context = ?1 AND is_active = 1
         ORDER BY started_at DESC LIMIT 1"
    )?;
    
    let result = stmt.query_row(params![context], |row| {
        Ok(SessionRow {
            id: row.get(0)?,
            context: row.get(1)?,
            started_at: row.get(2)?,
            ended_at: row.get(3)?,
            last_page_at: row.get(4)?,
            reading_time_seconds: row.get(5)?,
            pages_viewed: row.get(6)?,
            total_characters: row.get(7)?,
            is_active: row.get::<_, i64>(8)? == 1,
        })
    });
    
    match result {
        Ok(session) => Ok(Some(session)),
        Err(Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

/// Close/finalize a session by setting is_active=0 and ended_at
fn close_session(conn: &Connection, session_id: i64, ended_at: i64) -> Result<(), Error> {
    conn.execute(
        "UPDATE reading_sessions SET is_active = 0, ended_at = ?1 WHERE id = ?2",
        params![ended_at, session_id],
    )?;
    Ok(())
}

/// Update an existing active session with new page view data
fn update_session(
    conn: &Connection,
    session_id: i64,
    timestamp: i64,
    time_to_add: i64,
    char_count: i64,
) -> Result<(), Error> {
    conn.execute(
        "UPDATE reading_sessions SET
            last_page_at = ?1,
            reading_time_seconds = reading_time_seconds + ?2,
            pages_viewed = pages_viewed + 1,
            total_characters = total_characters + ?3
         WHERE id = ?4",
        params![timestamp, time_to_add, char_count, session_id],
    )?;
    Ok(())
}

/// Create a new reading session, returns the new session ID
fn create_new_session(
    conn: &Connection,
    context: &str,
    timestamp: i64,
    char_count: i64,
) -> Result<i64, Error> {
    conn.execute(
        "INSERT INTO reading_sessions (context, started_at, last_page_at, reading_time_seconds, pages_viewed, total_characters, is_active)
         VALUES (?1, ?2, ?2, 0, 1, ?3, 1)",
        params![context, timestamp, char_count],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Process a page view and update sessions accordingly
/// This is the main entry point called by the page-view handler
/// Returns the session_id for linking page_view to session
pub fn process_page_view(
    conn: &Connection,
    page_url: &str,
    context: &str,
    timestamp: i64,  // Unix epoch seconds
) -> Result<i64, Error> {
    // 1. Get character count from OCR cache (if available, else 0)
    let char_count: i64 = conn
        .query_row(
            "SELECT text_length FROM ocr_cache WHERE page_url = ?1",
            params![page_url],
            |row| row.get(0),
        )
        .unwrap_or(0);
    
    // 2. Find active session for this context
    let active_session = find_active_session(conn, context)?;
    
    // 3. Determine session_id (create new or continue existing)
    let session_id = match active_session {
        Some(session) => {
            // Simple integer subtraction for gap calculation!
            let gap_seconds = timestamp - session.last_page_at;
            
            if gap_seconds > AFK_THRESHOLD_SECONDS {
                // AFK detected - close old session and start new one
                close_session(conn, session.id, session.last_page_at)?;
                create_new_session(conn, context, timestamp, char_count)?
            } else {
                // Continue existing session with capped time
                let time_to_add = gap_seconds.min(AFK_THRESHOLD_SECONDS);
                update_session(conn, session.id, timestamp, time_to_add, char_count)?;
                session.id
            }
        }
        None => create_new_session(conn, context, timestamp, char_count)?,
    };
    
    // 4. Insert page view WITH session_id for text reconstruction
    conn.execute(
        "INSERT INTO page_views (session_id, timestamp, page_url, context) VALUES (?1, ?2, ?3, ?4)",
        params![session_id, timestamp, page_url, context],
    )?;
    
    Ok(session_id)
}
