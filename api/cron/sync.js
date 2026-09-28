const { runIngestionPipeline } = require('../../services/ingestionService');

module.exports = async (req, res) => {
  // Mandatory CRON_SECRET authorization check (Fail closed if not configured)
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[CronSync] CRON_SECRET environment variable is not configured. Failing closed.');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const authHeader = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('[CronSync] Initiating authorized catalog sync...');
    const result = await runIngestionPipeline({ maxDiscovery: 30, concurrency: 3 });
    try {
      const { sendDiscordNotification } = require('../../scripts/notify_discord');
      await sendDiscordNotification({ event: 'catalog' });
    } catch(e) {}
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      result
    });
  } catch (err) {
    console.error('[CronSync] Error running automated sync:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Ingestion pipeline execution failed'
    });
  }
};
