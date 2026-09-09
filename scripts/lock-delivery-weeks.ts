// CLI för att låsa förfallna leveransveckor (samma motor som cron).
import { lockDueDeliveryWeeks } from "../src/lib/warehouse/lock";

lockDueDeliveryWeeks()
  .then((result) => {
    console.log(`Prenumerationsordrar: ${result.generated}`);
    for (const l of result.locks) {
      console.log(`  ${l.deliveryDate}: ${l.status}${l.alreadyLocked ? " (redan låst)" : ""}${l.emailed ? " mejlad" : ""}${l.error ? ` FEL ${l.error}` : ""}`);
    }
    process.exit(result.locks.some((l) => l.error) ? 1 : 0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
