const accountId = process.env.ZOOM_ACCOUNT_ID;
const clientId = process.env.ZOOM_CLIENT_ID;
const clientSecret = process.env.ZOOM_CLIENT_SECRET;

let cachedToken = null;
let tokenExpiresAt = null;

// Verificar si Zoom está configurado
const isZoomConfigured = accountId && clientId && clientSecret;
if (isZoomConfigured) {
  console.log('📹 Servicio Zoom S2S OAuth disponible.');
} else {
  console.log('📹 Zoom en modo simulado (faltan credenciales ZOOM_* en .env). Las reuniones se simularán.');
}

/**
 * Obtener access token de Zoom mediante Server-to-Server OAuth.
 * Se cachea para reutilizarlo antes de que expire (3600 segs).
 */
async function getAccessToken() {
  if (!isZoomConfigured) return null;

  // Si ya tenemos token y no ha expirado (margen de 30 segundos)
  if (cachedToken && tokenExpiresAt && Date.now() < tokenExpiresAt - 30000) {
    return cachedToken;
  }

  try {
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch('https://zoom.us/oauth/token?grant_type=account_credentials&account_id=' + accountId, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error en auth Zoom (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in * 1000);
    
    return cachedToken;
  } catch (err) {
    console.error('❌ Error al obtener token de Zoom:', err.message);
    return null;
  }
}

/**
 * Crear reunión en Zoom
 */
async function createMeeting(topic, startTimeISO, durationMinutes = 60) {
  if (!isZoomConfigured) {
    return {
      id: 'zoom_mock_' + Math.floor(Math.random() * 100000000),
      join_url: 'https://zoom.us/j/mock-meeting-' + Math.floor(Math.random() * 1000000),
      start_url: 'https://zoom.us/s/mock-meeting-' + Math.floor(Math.random() * 1000000)
    };
  }

  const token = await getAccessToken();
  if (!token) return null;

  try {
    const response = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        topic,
        type: 2, // 2 = Scheduled meeting
        start_time: startTimeISO, // Formato ISO 8601: "YYYY-MM-DDTHH:MM:SS"
        duration: durationMinutes,
        timezone: 'America/Mexico_City',
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: true,
          mute_upon_entry: true,
          waiting_room: false
        }
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`Zoom Meeting Creation API Error (${response.status}):`, errBody);
      return null;
    }

    const data = await response.json();
    return {
      id: data.id.toString(),
      join_url: data.join_url,
      start_url: data.start_url
    };
  } catch (err) {
    console.error('❌ Error llamando a la API de Zoom para crear reunión:', err);
    return null;
  }
}

/**
 * Actualizar reunión existente en Zoom
 */
async function updateMeeting(meetingId, topic, startTimeISO, durationMinutes = 60) {
  if (!isZoomConfigured || !meetingId || meetingId.startsWith('zoom_mock_')) {
    return true;
  }

  const token = await getAccessToken();
  if (!token) return false;

  try {
    const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        topic,
        type: 2,
        start_time: startTimeISO,
        duration: durationMinutes,
        timezone: 'America/Mexico_City'
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`Zoom Meeting Update API Error (${response.status}):`, errBody);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`❌ Error actualizando reunión Zoom ${meetingId}:`, err);
    return false;
  }
}

/**
 * Eliminar reunión en Zoom
 */
async function deleteMeeting(meetingId) {
  if (!isZoomConfigured || !meetingId || meetingId.startsWith('zoom_mock_')) {
    return true;
  }

  const token = await getAccessToken();
  if (!token) return false;

  try {
    const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok && response.status !== 404) {
      const errBody = await response.text();
      console.error(`Zoom Meeting Delete API Error (${response.status}):`, errBody);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`❌ Error eliminando reunión Zoom ${meetingId}:`, err);
    return false;
  }
}

module.exports = {
  createMeeting,
  updateMeeting,
  deleteMeeting,
  isZoomConfigured: () => isZoomConfigured
};
