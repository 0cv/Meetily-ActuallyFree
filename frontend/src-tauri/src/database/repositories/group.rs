//! Recurring meeting groups. Membership is whoever was linked as a contact
//! in the group's meetings. A meeting joins a group when recording starts
//! from that group, or when the meeting page assigns one later.

use serde::Serialize;
use sqlx::SqlitePool;
use uuid::Uuid;

use super::person::normalize_person_name;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupListItem {
    pub id: String,
    pub name: String,
    pub meeting_count: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_meeting_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_meeting_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_meeting_title: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupMember {
    pub person_id: String,
    pub display_name: String,
    pub meeting_count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupMeetingRow {
    pub meeting_id: String,
    pub title: String,
    pub created_at: String,
    pub present: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupDetail {
    pub id: String,
    pub name: String,
    pub meeting_count: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_meeting_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_meeting_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_meeting_title: Option<String>,
    pub frequent: Vec<GroupMember>,
    pub rare: Vec<GroupMember>,
    pub meetings: Vec<GroupMeetingRow>,
}

pub struct GroupsRepository;

impl GroupsRepository {
    pub async fn list(pool: &SqlitePool) -> Result<Vec<GroupListItem>, sqlx::Error> {
        let rows = sqlx::query_as::<_, (String, String, i64, Option<String>, Option<String>, Option<String>)>(
            "SELECT g.id, g.name, \
                    (SELECT COUNT(*) FROM meetings m WHERE m.group_id = g.id), \
                    (SELECT m.created_at FROM meetings m WHERE m.group_id = g.id ORDER BY m.created_at DESC LIMIT 1), \
                    (SELECT m.id FROM meetings m WHERE m.group_id = g.id ORDER BY m.created_at DESC LIMIT 1), \
                    (SELECT m.title FROM meetings m WHERE m.group_id = g.id ORDER BY m.created_at DESC LIMIT 1) \
             FROM groups g \
             ORDER BY COALESCE( \
                (SELECT m.created_at FROM meetings m WHERE m.group_id = g.id ORDER BY m.created_at DESC LIMIT 1), \
                g.created_at) DESC",
        )
        .fetch_all(pool)
        .await?;
        Ok(rows
            .into_iter()
            .map(|(id, name, meeting_count, last_meeting_at, last_meeting_id, last_meeting_title)| {
                GroupListItem {
                    id,
                    name,
                    meeting_count,
                    last_meeting_at,
                    last_meeting_id,
                    last_meeting_title,
                }
            })
            .collect())
    }

    pub async fn create(pool: &SqlitePool, name: &str) -> Result<GroupListItem, sqlx::Error> {
        let name = name.trim();
        if name.is_empty() {
            return Err(sqlx::Error::Protocol("Group name is required".into()));
        }
        let normalized = normalize_person_name(name);
        if let Some((id, existing)) = sqlx::query_as::<_, (String, String)>(
            "SELECT id, name FROM groups WHERE normalized_name = ?",
        )
        .bind(&normalized)
        .fetch_optional(pool)
        .await?
        {
            let mut item = Self::list(pool).await?;
            if let Some(found) = item.drain(..).find(|group| group.id == id) {
                return Ok(found);
            }
            return Ok(GroupListItem {
                id,
                name: existing,
                meeting_count: 0,
                last_meeting_at: None,
                last_meeting_id: None,
                last_meeting_title: None,
            });
        }
        let id = format!("group-{}", Uuid::new_v4());
        sqlx::query(
            "INSERT INTO groups (id, name, normalized_name, created_at, updated_at) \
             VALUES (?, ?, ?, datetime('now'), datetime('now'))",
        )
        .bind(&id)
        .bind(name)
        .bind(&normalized)
        .execute(pool)
        .await?;
        Ok(GroupListItem {
            id,
            name: name.to_string(),
            meeting_count: 0,
            last_meeting_at: None,
            last_meeting_id: None,
            last_meeting_title: None,
        })
    }

    pub async fn set_meeting_group(
        pool: &SqlitePool,
        meeting_id: &str,
        group_id: Option<&str>,
    ) -> Result<(), sqlx::Error> {
        let exists: Option<String> = sqlx::query_scalar("SELECT id FROM meetings WHERE id = ?")
            .bind(meeting_id)
            .fetch_optional(pool)
            .await?;
        if exists.is_none() {
            return Err(sqlx::Error::RowNotFound);
        }
        if let Some(group_id) = group_id {
            let group: Option<String> = sqlx::query_scalar("SELECT id FROM groups WHERE id = ?")
                .bind(group_id)
                .fetch_optional(pool)
                .await?;
            if group.is_none() {
                return Err(sqlx::Error::RowNotFound);
            }
        }
        sqlx::query("UPDATE meetings SET group_id = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(group_id)
            .bind(meeting_id)
            .execute(pool)
            .await?;
        Ok(())
    }

    pub async fn meeting_group(
        pool: &SqlitePool,
        meeting_id: &str,
    ) -> Result<Option<GroupListItem>, sqlx::Error> {
        let row = sqlx::query_as::<_, (String, String)>(
            "SELECT g.id, g.name FROM groups g \
             JOIN meetings m ON m.group_id = g.id \
             WHERE m.id = ?",
        )
        .bind(meeting_id)
        .fetch_optional(pool)
        .await?;
        Ok(row.map(|(id, name)| GroupListItem {
            id,
            name,
            meeting_count: 0,
            last_meeting_at: None,
            last_meeting_id: None,
            last_meeting_title: None,
        }))
    }

    pub async fn detail(
        pool: &SqlitePool,
        group_id: &str,
        query: Option<&str>,
    ) -> Result<GroupDetail, sqlx::Error> {
        let name: String = sqlx::query_scalar("SELECT name FROM groups WHERE id = ?")
            .bind(group_id)
            .fetch_optional(pool)
            .await?
            .ok_or(sqlx::Error::RowNotFound)?;

        let rows = sqlx::query_as::<_, (String, String, String, Option<String>)>(
            "SELECT m.id, m.title, m.created_at, p.display_name \
             FROM meetings m \
             LEFT JOIN person_speakers ps ON ps.meeting_id = m.id \
             LEFT JOIN people p ON p.id = ps.person_id \
             WHERE m.group_id = ? \
             ORDER BY m.created_at DESC, p.display_name",
        )
        .bind(group_id)
        .fetch_all(pool)
        .await?;

        let mut meetings: Vec<GroupMeetingRow> = Vec::new();
        let mut counts: std::collections::HashMap<String, (String, i64)> = std::collections::HashMap::new();
        for (meeting_id, title, created_at, person_name) in rows {
            if meetings.last().map(|m| m.meeting_id.as_str()) != Some(meeting_id.as_str()) {
                meetings.push(GroupMeetingRow {
                    meeting_id: meeting_id.clone(),
                    title,
                    created_at,
                    present: Vec::new(),
                });
            }
            if let Some(person_name) = person_name {
                if let Some(meeting) = meetings.last_mut() {
                    if !meeting.present.iter().any(|name| name == &person_name) {
                        meeting.present.push(person_name.clone());
                        let entry = counts.entry(person_name.clone()).or_insert((person_name, 0));
                        entry.1 += 1;
                    }
                }
            }
        }

        let last_meeting = meetings.first().cloned();

        let meeting_total = meetings.len() as i64;
        let mut frequent = Vec::new();
        let mut rare = Vec::new();
        let mut members: Vec<GroupMember> = counts
            .into_iter()
            .map(|(person_id_unused, (display_name, meeting_count))| GroupMember {
                person_id: person_id_unused,
                display_name,
                meeting_count,
            })
            .collect();
        // counts were keyed by display name. Resolve ids.
        let named = sqlx::query_as::<_, (String, String)>(
            "SELECT DISTINCT p.id, p.display_name \
             FROM people p \
             JOIN person_speakers ps ON ps.person_id = p.id \
             JOIN meetings m ON m.id = ps.meeting_id \
             WHERE m.group_id = ?",
        )
        .bind(group_id)
        .fetch_all(pool)
        .await?;
        for member in &mut members {
            if let Some((id, _)) = named.iter().find(|(_, display)| display == &member.display_name) {
                member.person_id = id.clone();
            }
        }
        members.sort_by(|a, b| b.meeting_count.cmp(&a.meeting_count).then_with(|| a.display_name.cmp(&b.display_name)));
        for member in members {
            let is_rare = if meeting_total <= 3 {
                member.meeting_count * 2 < meeting_total.max(1)
            } else {
                member.meeting_count <= 2
            };
            if is_rare {
                rare.push(member);
            } else {
                frequent.push(member);
            }
        }

        let needle = query.unwrap_or("").trim().to_lowercase();
        if !needle.is_empty() {
            let like = format!("%{}%", needle.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_"));
            let transcript_hits: Vec<String> = sqlx::query_scalar(
                "SELECT DISTINCT t.meeting_id FROM transcripts t \
                 JOIN meetings m ON m.id = t.meeting_id \
                 WHERE m.group_id = ? AND lower(t.transcript) LIKE ? ESCAPE '\\'",
            )
            .bind(group_id)
            .bind(&like)
            .fetch_all(pool)
            .await?;
            meetings.retain(|meeting| {
                meeting.title.to_lowercase().contains(&needle)
                    || meeting.present.iter().any(|name| name.to_lowercase().contains(&needle))
                    || transcript_hits.iter().any(|id| id == &meeting.meeting_id)
            });
        }

        Ok(GroupDetail {
            id: group_id.to_string(),
            name,
            meeting_count: meeting_total,
            last_meeting_at: last_meeting.as_ref().map(|m| m.created_at.clone()),
            last_meeting_id: last_meeting.as_ref().map(|m| m.meeting_id.clone()),
            last_meeting_title: last_meeting.as_ref().map(|m| m.title.clone()),
            frequent,
            rare,
            meetings,
        })
    }
}

#[tauri::command]
pub async fn api_list_groups(
    state: tauri::State<'_, crate::state::AppState>,
) -> Result<Vec<GroupListItem>, String> {
    GroupsRepository::list(state.db_manager.pool())
        .await
        .map_err(|error| format!("Failed to list groups: {}", error))
}

#[tauri::command]
pub async fn api_create_group(
    state: tauri::State<'_, crate::state::AppState>,
    name: String,
) -> Result<GroupListItem, String> {
    GroupsRepository::create(state.db_manager.pool(), &name)
        .await
        .map_err(|error| format!("Failed to create group: {}", error))
}

#[tauri::command]
pub async fn api_get_group(
    state: tauri::State<'_, crate::state::AppState>,
    group_id: String,
    query: Option<String>,
) -> Result<GroupDetail, String> {
    GroupsRepository::detail(state.db_manager.pool(), &group_id, query.as_deref())
        .await
        .map_err(|error| match error {
            sqlx::Error::RowNotFound => "Group not found".to_string(),
            _ => format!("Failed to load group: {}", error),
        })
}

#[tauri::command]
pub async fn api_set_meeting_group(
    state: tauri::State<'_, crate::state::AppState>,
    meeting_id: String,
    group_id: Option<String>,
) -> Result<(), String> {
    GroupsRepository::set_meeting_group(
        state.db_manager.pool(),
        &meeting_id,
        group_id.as_deref().filter(|id| !id.trim().is_empty()),
    )
    .await
    .map_err(|error| match error {
        sqlx::Error::RowNotFound => "Meeting or group not found".to_string(),
        _ => format!("Failed to update meeting group: {}", error),
    })
}

#[tauri::command]
pub async fn api_get_meeting_group(
    state: tauri::State<'_, crate::state::AppState>,
    meeting_id: String,
) -> Result<Option<GroupListItem>, String> {
    GroupsRepository::meeting_group(state.db_manager.pool(), &meeting_id)
        .await
        .map_err(|error| format!("Failed to load meeting group: {}", error))
}
