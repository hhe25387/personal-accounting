const personas = new Set(['bestie', 'savage', 'parent', 'royal'])
const tones = new Set(['gentle', 'medium', 'strong'])
const proactivityLevels = new Set(['quiet', 'moderate', 'active'])
const focuses = new Set([
  'clarity',
  'impulse_control',
  'habit',
  'saving',
  'companionship',
])

function createPreferenceService(database) {
  function getPreferences(userId) {
    const row = database
      .prepare('SELECT * FROM user_preferences WHERE user_id = ?')
      .get(userId)
    if (!row) return null

    const savedProfile = row.persona
      ? {
          persona: row.persona,
          toneIntensity: row.tone_intensity,
          proactivity: row.proactivity,
          focus: row.focus,
          ...(row.preferred_title
            ? { preferredTitle: row.preferred_title }
            : {}),
        }
      : null

    return {
      mode: row.mode,
      profile: row.mode === 'personality' ? savedProfile : null,
      savedProfile,
    }
  }

  function savePreferences(userId, { mode, profile } = {}) {
    if (!['standard', 'personality'].includes(mode)) {
      throw new TypeError('mode must be standard or personality')
    }

    let normalized = null
    if (mode === 'personality') {
      if (!profile || !personas.has(profile.persona)) {
        throw new TypeError('Select a valid companion personality')
      }
      if (!tones.has(profile.toneIntensity)) {
        throw new TypeError('Select a valid tone intensity')
      }
      if (!proactivityLevels.has(profile.proactivity)) {
        throw new TypeError('Select a valid proactivity level')
      }
      if (!focuses.has(profile.focus)) {
        throw new TypeError('Select a valid focus')
      }
      const preferredTitle =
        profile.persona === 'royal' && typeof profile.preferredTitle === 'string'
          ? profile.preferredTitle.trim().slice(0, 10) || 'Your Highness'
          : null
      normalized = { ...profile, preferredTitle }
    }

    database
      .prepare(`
        INSERT INTO user_preferences (
          user_id, mode, persona, tone_intensity, proactivity, focus,
          preferred_title, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          mode = excluded.mode,
          persona = CASE WHEN excluded.mode = 'personality'
            THEN excluded.persona ELSE user_preferences.persona END,
          tone_intensity = CASE WHEN excluded.mode = 'personality'
            THEN excluded.tone_intensity ELSE user_preferences.tone_intensity END,
          proactivity = CASE WHEN excluded.mode = 'personality'
            THEN excluded.proactivity ELSE user_preferences.proactivity END,
          focus = CASE WHEN excluded.mode = 'personality'
            THEN excluded.focus ELSE user_preferences.focus END,
          preferred_title = CASE WHEN excluded.mode = 'personality'
            THEN excluded.preferred_title ELSE user_preferences.preferred_title END,
          updated_at = CURRENT_TIMESTAMP
      `)
      .run(
        userId,
        mode,
        normalized?.persona || null,
        normalized?.toneIntensity || null,
        normalized?.proactivity || null,
        normalized?.focus || null,
        normalized?.preferredTitle || null,
      )

    return getPreferences(userId)
  }

  return { getPreferences, savePreferences }
}

module.exports = createPreferenceService
