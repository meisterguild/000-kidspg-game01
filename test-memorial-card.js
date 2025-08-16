/**
 * 記念カード生成テスト用スクリプト
 * 
 * 使用方法:
 * node test-memorial-card.js results/20250816_172248
 */

const { MemorialCardTester } = require('./dist/main/main/services/memorial-card-test');

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node test-memorial-card.js <resultDir>');
    console.log('Example: node test-memorial-card.js results/20250816_172248');
    process.exit(1);
  }
  
  const resultDir = args[0];
  
  try {
    const tester = new MemorialCardTester();
    const result = await tester.testMemorialCardGeneration(resultDir);
    
    if (result.success) {
      console.log(`✅ Test completed successfully!`);
      console.log(`📄 Output: ${result.outputPath}`);
      if (result.scriptPath) {
        console.log(`📜 Script: ${result.scriptPath}`);
      }
    } else {
      console.log(`❌ Test failed: ${result.error}`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Test execution error:', error);
    process.exit(1);
  }
}

main().catch(console.error);