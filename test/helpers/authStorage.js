export class TestAuthStorage {
  constructor() {
    this.tables = { Users: [], Admins: [], Sessions: [], AuditLogs: [] };
  }
  async read() {
    return structuredClone(this.tables);
  }
  async write(operations) {
    for (const { table, row, values } of operations) {
      if (row === undefined)
        this.tables[table].push({ ...values, row: this.tables[table].length + 1 });
      else
        Object.assign(
          this.tables[table].find((record) => record.row === row),
          values,
        );
    }
  }
}
