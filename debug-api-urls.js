// Debug script to check API configurations
// Paste this in Chrome DevTools console on the extension's options page

async function debugApiUrls() {
  // Get all storage keys related to API configurations
  const keys = ['groqApiKey', 'groqBaseUrl', 'moonshotApiKey', 'moonshotBaseUrl', 'customModels'];

  const results = await chrome.storage.sync.get(keys);

  console.log('🔧 API Configuration Debug Info:');
  console.log('=====================================');

  console.log('📡 Groq Configuration:');
  console.log('  API Key:', results.groqApiKey ? '✅ Configured' : '❌ Not set');
  console.log('  Base URL:', results.groqBaseUrl || 'https://api.groq.com/openai/v1 (default)');

  console.log('\n🌙 Moonshot Configuration:');
  console.log('  API Key:', results.moonshotApiKey ? '✅ Configured' : '❌ Not set');
  console.log('  Base URL:', results.moonshotBaseUrl || 'https://api.moonshot.cn/v1 (default)');

  console.log('\n🤖 Custom Models:');
  const customModels = results.customModels || [];
  const moonshotModels = customModels.filter(m => m.type === 'moonshot');
  const groqModels = customModels.filter(m => m.type === 'groq');

  console.log('  Moonshot Models:', moonshotModels.length);
  moonshotModels.forEach((model, i) => {
    console.log(`    ${i + 1}. ${model.label} (${model.value})`);
  });

  console.log('  Groq Models:', groqModels.length);
  groqModels.forEach((model, i) => {
    console.log(`    ${i + 1}. ${model.label} (${model.value})`);
  });

  return results;
}

// Run the debug function
debugApiUrls();
