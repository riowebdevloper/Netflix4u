const { runIngestionPipeline } = require('../../services/ingestionService');

module.exports = async (req, res) => {
  // Optional CRON_SECRET authorization check
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized cron request' });
    }
  }

  try {
    console.log('[CronSync] Initiating automated catalog sync...');
    const result = await runIngestionPipeline({ maxDiscovery: 30, concurrency: 3 });
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      result
    });
  } catch (err) {
    console.error('[CronSync] Error running automated sync:', err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
