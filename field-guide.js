// The guide includes the current expedition without settling its rewards early.
export function discoveryRecords(meta, run) {
  const records = structuredClone(meta.discoveries || {});
  if (!run || run.settled) return records;
  for (const encounter of run.encounters || []) {
    const record = records[encounter.id] ||= { seen: 0, defeated: 0 };
    record.seen++;
    if (encounter.won) record.defeated++;
  }
  for (const id of new Set(run.partnerForms || [run.hero.id])) {
    const record = records[id] ||= { seen: 0, defeated: 0 };
    record.seen++;
  }
  return records;
}
