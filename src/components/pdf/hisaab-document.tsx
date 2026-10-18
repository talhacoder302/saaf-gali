import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import en from "@/i18n/en.json";
import { isBuiltInCategory } from "@/lib/expenses";
import { formatDate, formatRupees } from "@/lib/format";
import { monthLabel } from "@/lib/months";
import type { HisaabView } from "@/server/hisaab";

// The PDF uses the built-in Helvetica font, so its text is English only
// (category labels come from en.json so they match the app).

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function longMonth(month: string): string {
  const [year, mon] = month.split("-").map(Number);
  return `${MONTH_NAMES[(mon ?? 1) - 1]} ${year}`;
}

function categoryLabel(category: string): string {
  return isBuiltInCategory(category) ? en.expenses.category[category] : category;
}

/** "2026-10-04" -> "4 Oct 2026" (the day is already in Pakistan time). */
function dayLabel(day: string): string {
  const [, , date] = day.split("-").map(Number);
  return `${date} ${monthLabel(day.slice(0, 7))}`;
}

const styles = StyleSheet.create({
  page: { padding: 36, paddingBottom: 56, fontSize: 10, fontFamily: "Helvetica", color: "#111827" },
  header: { borderBottomWidth: 1, borderColor: "#d1d5db", paddingBottom: 10, marginBottom: 14 },
  org: { fontSize: 15, fontFamily: "Helvetica-Bold" },
  title: { fontSize: 12, marginTop: 4 },
  muted: { color: "#6b7280" },
  section: { marginBottom: 14 },
  heading: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  tiles: { flexDirection: "row", gap: 6, marginBottom: 14 },
  tile: { flex: 1, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 4, padding: 8 },
  tileMain: { borderColor: "#16a34a", backgroundColor: "#f0fdf4" },
  tileValue: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 2 },
  negative: { color: "#b91c1c" },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderColor: "#f3f4f6" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, fontFamily: "Helvetica-Bold" },
  tableHead: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 1, borderColor: "#d1d5db", color: "#6b7280" },
  tableRow: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 1, borderColor: "#f3f4f6" },
  colDate: { width: 70 },
  colCategory: { width: 80 },
  colDescription: { flex: 1, paddingRight: 8 },
  colAmount: { width: 70, textAlign: "right" },
  note: { padding: 6, backgroundColor: "#fffbeb", color: "#92400e", marginBottom: 14 },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", color: "#9ca3af", fontSize: 8 },
});

/** Returns the <Document> element itself (renderToBuffer needs a Document, not a wrapper component). */
export function buildHisaabDocument(hisaab: HisaabView) {
  const { balance, collection } = hisaab;
  const title = `${hisaab.area.name}, ${hisaab.area.city}: hisaab for ${longMonth(hisaab.month)}`;
  const tiles = [
    { label: "Opening balance", value: balance.opening },
    { label: "Collected", value: balance.collected },
    { label: "Spent", value: balance.spent },
    { label: "Closing balance", value: balance.closing, main: true },
  ];

  return (
    <Document title={title} author={hisaab.organisationName}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.org}>{hisaab.organisationName}</Text>
          <Text style={styles.title}>{title}</Text>
        </View>

        <View style={styles.tiles}>
          {tiles.map((tile) => (
            <View key={tile.label} style={tile.main ? [styles.tile, styles.tileMain] : styles.tile}>
              <Text style={styles.muted}>{tile.label}</Text>
              <Text style={tile.value < 0 ? [styles.tileValue, styles.negative] : styles.tileValue}>{formatRupees(tile.value)}</Text>
            </View>
          ))}
        </View>
        <Text style={[styles.muted, { marginTop: -8, marginBottom: 14 }]}>
          Opening balance is last month&apos;s closing balance. Closing = opening + collected - spent. Collected means fees received
          during the month (including arrears and advance).
        </Text>

        {hisaab.pending.count > 0 ? (
          <Text style={styles.note}>
            {hisaab.pending.count} {hisaab.pending.count === 1 ? "expense" : "expenses"} ({formatRupees(hisaab.pending.amount)}) waiting
            for committee approval, not counted yet.
          </Text>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.heading}>Fee collection</Text>
          {collection ? (
            <>
              <View style={styles.row}>
                <Text>Households paid</Text>
                <Text>
                  {collection.paid} of {collection.households}
                  {collection.partial > 0 ? ` (${collection.partial} paid part)` : ""}
                </Text>
              </View>
              <View style={styles.row}>
                <Text>This month&apos;s fees collected</Text>
                <Text>{collection.percent}%</Text>
              </View>
            </>
          ) : (
            <Text style={styles.muted}>Bills for this month have not been made yet.</Text>
          )}
          <Text style={[styles.muted, { marginTop: 4 }]}>Only totals are shown, never names or amounts of individual houses.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Spending by category</Text>
          {hisaab.byCategory.length === 0 ? <Text style={styles.muted}>Nothing was spent this month.</Text> : null}
          {hisaab.byCategory.map((entry) => (
            <View key={entry.category} style={styles.row}>
              <Text>{categoryLabel(entry.category)}</Text>
              <Text>{formatRupees(entry.amount)}</Text>
            </View>
          ))}
          {hisaab.byCategory.length > 0 ? (
            <View style={styles.totalRow}>
              <Text>Total spent</Text>
              <Text>{formatRupees(balance.spent)}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Last 6 months</Text>
          <View style={styles.tableHead}>
            <Text style={{ flex: 1 }}>Month</Text>
            <Text style={styles.colAmount}>Collected</Text>
            <Text style={styles.colAmount}>Spent</Text>
          </View>
          {hisaab.chart.map((entry) => (
            <View key={entry.month} style={styles.tableRow}>
              <Text style={{ flex: 1 }}>{monthLabel(entry.month)}</Text>
              <Text style={styles.colAmount}>{formatRupees(entry.collected)}</Text>
              <Text style={styles.colAmount}>{formatRupees(entry.spent)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Expenses ({hisaab.expenses.length})</Text>
          {hisaab.expenses.length === 0 ? (
            <Text style={styles.muted}>No expenses this month.</Text>
          ) : (
            <>
              <View style={styles.tableHead} fixed>
                <Text style={styles.colDate}>Date</Text>
                <Text style={styles.colCategory}>Category</Text>
                <Text style={styles.colDescription}>Description</Text>
                <Text style={styles.colAmount}>Amount</Text>
              </View>
              {hisaab.expenses.map((expense) => (
                <View key={expense.id} style={styles.tableRow} wrap={false}>
                  <Text style={styles.colDate}>{dayLabel(expense.day)}</Text>
                  <Text style={styles.colCategory}>{categoryLabel(expense.category)}</Text>
                  <Text style={styles.colDescription}>
                    {expense.description}
                    {expense.hasPhoto ? " (receipt photo online)" : ""}
                  </Text>
                  <Text style={styles.colAmount}>{formatRupees(expense.amount)}</Text>
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text>Total</Text>
                <Text>{formatRupees(balance.spent)}</Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.footer} fixed>
          <Text>Generated by Saaf Gali on {formatDate(new Date(), "d MMM yyyy, h:mm a")}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
