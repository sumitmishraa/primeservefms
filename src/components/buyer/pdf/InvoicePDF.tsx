/**
 * InvoicePDF — server-only React-PDF component.
 * NEVER import this file in client components.
 */
import React from 'react';
import {
  Document, Page, Text, View, StyleSheet,
} from '@react-pdf/renderer';

/* ─── Types (mirrors DB schema) ─── */
export interface InvoiceItem {
  product_name: string;
  product_sku: string | null;
  quantity: number;
  unit_price: number;
  gst_rate: number;
  gst_amount: number;
  total_amount: number;
}

export interface InvoiceData {
  order_number: string;
  created_at: string;
  subtotal: number;
  gst_amount: number;
  shipping_amount: number;
  total_amount: number;
  notes: string | null;
  payment_method: 'razorpay' | 'credit_45day';
  /* Buyer / consignee */
  buyer_name: string;
  company_name: string | null;
  gst_number: string | null;
  /* Shipping address */
  address_name: string;
  address_line1: string;
  address_line2: string | null;
  address_city: string;
  address_state: string;
  address_pincode: string;
  address_phone: string;
  /* Line items */
  items: InvoiceItem[];
}

/* ─── Helpers ─── */
function inr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
  });
}

/* ─── Styles ─── */
const S = StyleSheet.create({
  page:        { fontFamily: 'Helvetica', fontSize: 9, padding: '20mm 18mm', color: '#1e293b', backgroundColor: '#ffffff' },
  /* Header */
  header:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  brand:       { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#0d9488', letterSpacing: 0.5 },
  brandSub:    { fontSize: 7, color: '#64748b', marginTop: 2 },
  titleBlock:  { alignItems: 'flex-end' },
  title:       { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#1e293b', letterSpacing: 1 },
  invNum:      { fontSize: 8, color: '#64748b', marginTop: 3 },
  invDate:     { fontSize: 8, color: '#64748b', marginTop: 1 },
  /* Divider */
  divider:     { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginVertical: 10 },
  /* Two-column party block */
  parties:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  partyBlock:  { width: '47%' },
  partyLabel:  { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  partyName:   { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1e293b', marginBottom: 2 },
  partyLine:   { fontSize: 8, color: '#475569', lineHeight: 1.4 },
  /* Table */
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', paddingVertical: 5, paddingHorizontal: 5, borderRadius: 2 },
  tableRow:    { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 5, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tableRowAlt: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 5, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  colSno:      { width: '5%',  color: '#64748b' },
  colDesc:     { width: '40%' },
  colHSN:      { width: '10%', textAlign: 'center', color: '#64748b' },
  colQty:      { width: '7%',  textAlign: 'center' },
  colUnit:     { width: '13%', textAlign: 'right' },
  colGST:      { width: '8%',  textAlign: 'center' },
  colGSTAmt:   { width: '10%', textAlign: 'right' },
  colTotal:    { width: '12%', textAlign: 'right', fontFamily: 'Helvetica-Bold' },
  thText:      { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 },
  /* Totals */
  totals:      { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  totalsBox:   { width: '46%' },
  totalRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalLabel:  { fontSize: 8, color: '#475569' },
  totalValue:  { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#1e293b' },
  grandRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderTopWidth: 1.5, borderTopColor: '#0d9488', marginTop: 4 },
  grandLabel:  { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#0d9488' },
  grandValue:  { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#0d9488' },
  /* Notes */
  notes:       { marginTop: 14, padding: 8, backgroundColor: '#f8fafc', borderRadius: 3 },
  notesLabel:  { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', marginBottom: 3 },
  notesText:   { fontSize: 8, color: '#475569', lineHeight: 1.4 },
  /* Footer */
  footer:      { position: 'absolute', bottom: '15mm', left: '18mm', right: '18mm' },
  footerLine:  { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 6 },
  footerText:  { fontSize: 7, color: '#94a3b8', textAlign: 'center', lineHeight: 1.4 },
});

/* ─── Component ─── */
export function InvoicePDF({ order }: { order: InvoiceData }) {
  return (
    <Document title={`Invoice ${order.order_number}`} author="PrimeServe Facility Solutions">
      <Page size="A4" style={S.page}>

        {/* Header */}
        <View style={S.header}>
          <View>
            <Text style={S.brand}>PrimeServe</Text>
            <Text style={S.brandSub}>Facility Solutions</Text>
            <Text style={[S.brandSub, { marginTop: 4 }]}>GSTIN: 29AAGCP1234A1Z5</Text>
            <Text style={S.brandSub}>Bangalore, Karnataka — 560001</Text>
            <Text style={S.brandSub}>credit@primeserve.in</Text>
          </View>
          <View style={S.titleBlock}>
            <Text style={S.title}>TAX INVOICE</Text>
            <Text style={S.invNum}>#{order.order_number}</Text>
            <Text style={S.invDate}>Date: {fmtDate(order.created_at)}</Text>
            <Text style={[S.invDate, { marginTop: 4, color: order.payment_method === 'credit_45day' ? '#d97706' : '#059669' }]}>
              {order.payment_method === 'credit_45day' ? '45-Day Credit' : 'Paid Online'}
            </Text>
          </View>
        </View>

        <View style={S.divider} />

        {/* Party details */}
        <View style={S.parties}>
          {/* Bill To */}
          <View style={S.partyBlock}>
            <Text style={S.partyLabel}>Bill To</Text>
            <Text style={S.partyName}>{order.company_name ?? order.buyer_name}</Text>
            {order.gst_number && <Text style={S.partyLine}>GSTIN: {order.gst_number}</Text>}
            <Text style={S.partyLine}>{order.address_line1}</Text>
            {order.address_line2 ? <Text style={S.partyLine}>{order.address_line2}</Text> : null}
            <Text style={S.partyLine}>{order.address_city}, {order.address_state} — {order.address_pincode}</Text>
            <Text style={S.partyLine}>Ph: {order.address_phone}</Text>
          </View>
          {/* Ship To */}
          <View style={S.partyBlock}>
            <Text style={S.partyLabel}>Ship To</Text>
            <Text style={S.partyName}>{order.address_name}</Text>
            <Text style={S.partyLine}>{order.address_line1}</Text>
            {order.address_line2 ? <Text style={S.partyLine}>{order.address_line2}</Text> : null}
            <Text style={S.partyLine}>{order.address_city}, {order.address_state} — {order.address_pincode}</Text>
            <Text style={S.partyLine}>Ph: {order.address_phone}</Text>
          </View>
        </View>

        <View style={S.divider} />

        {/* Items table */}
        {/* Header row */}
        <View style={S.tableHeader}>
          <Text style={[S.colSno, S.thText]}>#</Text>
          <Text style={[S.colDesc, S.thText]}>Description</Text>
          <Text style={[S.colHSN, S.thText]}>HSN</Text>
          <Text style={[S.colQty, S.thText]}>Qty</Text>
          <Text style={[S.colUnit, S.thText]}>Unit Price</Text>
          <Text style={[S.colGST, S.thText]}>GST%</Text>
          <Text style={[S.colGSTAmt, S.thText]}>GST Amt</Text>
          <Text style={[S.colTotal, S.thText]}>Total</Text>
        </View>

        {order.items.map((item, idx) => (
          <View key={idx} style={idx % 2 === 0 ? S.tableRow : S.tableRowAlt}>
            <Text style={S.colSno}>{idx + 1}</Text>
            <View style={S.colDesc}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#1e293b' }}>{item.product_name}</Text>
              {item.product_sku ? <Text style={{ fontSize: 7, color: '#94a3b8' }}>SKU: {item.product_sku}</Text> : null}
            </View>
            <Text style={S.colHSN}>—</Text>
            <Text style={[S.colQty, { fontSize: 8 }]}>{item.quantity}</Text>
            <Text style={[S.colUnit, { fontSize: 8 }]}>{inr(item.unit_price)}</Text>
            <Text style={[S.colGST, { fontSize: 8 }]}>{item.gst_rate}%</Text>
            <Text style={[S.colGSTAmt, { fontSize: 8 }]}>{inr(item.gst_amount)}</Text>
            <Text style={[S.colTotal, { fontSize: 8 }]}>{inr(item.total_amount)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={S.totals}>
          <View style={S.totalsBox}>
            <View style={S.totalRow}>
              <Text style={S.totalLabel}>Subtotal (excl. GST)</Text>
              <Text style={S.totalValue}>{inr(order.subtotal)}</Text>
            </View>
            <View style={S.totalRow}>
              <Text style={S.totalLabel}>GST</Text>
              <Text style={S.totalValue}>{inr(order.gst_amount)}</Text>
            </View>
            {order.shipping_amount > 0 && (
              <View style={S.totalRow}>
                <Text style={S.totalLabel}>Shipping</Text>
                <Text style={S.totalValue}>{inr(order.shipping_amount)}</Text>
              </View>
            )}
            <View style={S.grandRow}>
              <Text style={S.grandLabel}>Grand Total</Text>
              <Text style={S.grandValue}>{inr(order.total_amount)}</Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {order.notes && (
          <View style={S.notes}>
            <Text style={S.notesLabel}>Buyer Notes</Text>
            <Text style={S.notesText}>{order.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={S.footer} fixed>
          <View style={S.footerLine}>
            <Text style={S.footerText}>
              This is a computer-generated invoice. No signature required.{'\n'}
              For queries: credit@primeserve.in | PrimeServe Facility Solutions Pvt. Ltd., Bangalore — 560001
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
