// CLI för att generera kommande prenumerationsordrar (samma motor som
// admin-knappen och cron-endpointen). Säker att köra flera gånger.
import { generateDueSubscriptionOrders } from "../src/lib/subscriptions/service";

generateDueSubscriptionOrders()
  .then((result) => {
    console.log(`Genererade: ${result.generated.length}`);
    for (const g of result.generated) {
      console.log(`  ${g.subscriptionNumber} -> ${g.orderNumber} (${g.deliveryDate})`);
    }
    if (result.skipped.length) {
      console.log(`Överhoppade: ${result.skipped.length}`);
      for (const s of result.skipped) console.log(`  ${s.subscriptionNumber}: ${s.reason}`);
    }
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
