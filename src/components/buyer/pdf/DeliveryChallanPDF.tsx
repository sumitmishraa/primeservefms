/**
 * DeliveryChallanPDF — server-only React-PDF component.
 * NEVER import this file in client components.
 */
import React from 'react';
import {
  Document, Page, Text, View, StyleSheet,
} from '@react-pdf/renderer';

/* ─── Types ─── */
export interface DCItem {
  product_name: string;
  product_sku: string | null;
  quantity: number;
}

export interface DCData {
  order_number: string;
  created_at: string;
  delivered_at: string | null;
  /* Consignee */
  address_name: string;
  address_line1: string;
  address_line2: string | null;
  address_city: string;
  address_state: string;
  address_pincode: string;
  address_phone: string;
  /* Consignor (PrimeServe) */
  company_name: string | null;
  buyer_name: string;
  /* Items */
  items: DCItem[];
}

/* ─── Helpers ─── */
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
  });
}

/* ─── Styles ─── */
const S = StyleSheet.create({
  page:        { fontFamily: 'Helvetica', fontSize: 9, padding: '20mm 18mm', color: '#1e293b', backgroundColor: '#ffffff' },
  /* Header */
  header:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  brand:       { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#0d9488', letterSpacing: 0.5 },
  brandSub:    { fontSize: 7, color: '#64748b', marginTop: 2 },
  titleBlock:  { alignItems: 'flex-end' },
  title:       { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#1e293b', letterSpacing: 1 },
  dcNum:       { fontSize: 8, color: '#64748b', marginTop: 3 },
  dcDate:      { fontSize: 8, color: '#64748b', marginTop: 1 },
  divider:     { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginVertical: 10 },
  /* Parties */
  parties:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  partyBlock:  { width: '47%' },
  partyLabel:  { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  partyName:   { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1e293b', marginBottom: 2 },
  partyLine:   { fontSize: 8, color: '#475569', lineHeight: 1.4 },
  /* Items table */
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', paddingVertical: 5, paddingHorizontal: 5, borderRadius: 2 },
  tableRow:    { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 5, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tableRowAlt: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 5, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  colSno:      { width: '6%' },
  colDesc:     { width: '64%' },
  colQty:      { width: '15%', textAlign: 'center' },
  colUnit:     { width: '15%', textAlign: 'right' },
  thText:      { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 },
  /* Driver / signature section */
  grid2:       { flexDirection: 'row', gap: 20, marginTop: 20 },
  fieldBlock:  { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4, padding: 8 },
  fieldLabel:  { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 3 },
  fieldLine:   { borderBottomWidth: 1, borderBottomColor: '#cbd5e1', marginTop: 14 },
  sigBox:      { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4, padding: 8, height: 70, justifyContent: 'space-between' },
  sigLabel:    { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase' },
  sigLine:     { borderBottomWidth: 1, borderBottomColor: '#cbd5e1', marginTop: 'auto' },
  sigName:     { fontSize: 7, color: '#94a3b8', marginTop: 3 },
  /* Footer */
  footer:      { position: 'absolute', bottom: '15mm', left: '18mm', right: '18mm' },
  footerLine:  { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 6 },
  footerText:  { fontSize: 7, color: '#94a3b8', textAlign: 'center', lineHeight: 1.4 },
});

/* ─── Component ─── */
export function DeliveryChallanPDF({ order }: { order: DCData }) {
  const dcNumber = `DC-${order.order_number}`;

  return (
    <Document title={`Delivery Challan ${dcNumber}`} author="PrimeServe Facility Solutions">
      <Page size="A4" style={S.page}>

        {/* Header */}
        <View style={S.header}>
          <View>
            <Text style={S.brand}>PrimeServe</Text>
            <Text style={S.brandSub}>Facility Solutions</Text>
            <Text style={[S.brandSub, { marginTop: 4 }]}>Bangalore, Karnataka — 560001</Text>
          </View>
          <View style={S.titleBlock}>
            <Text style={S.title}>DELIVERY CHALLAN</Text>
            <Text style={S.dcNum}>DC No: {dcNumber}</Text>
            <Text style={S.dcDate}>Order: {order.order_number}</Text>
            <Text style={S.dcDate}>Date: {fmtDate(order.created_at)}</Text>
            {order.delivered_at && (
              <Text style={[S.dcDate, { color: '#059669' }]}>Delivered: {fmtDate(order.delivered_at)}</Text>
            )}
          </View>
        </View>

        <View style={S.divider} />

        {/* Party details */}
        <View style={S.parties}>
          <View style={S.partyBlock}>
            <Text style={S.partyLabel}>Consignor (Dispatched By)</Text>
            <Text style={S.partyName}>PrimeServe Facility Solutions Pvt. Ltd.</Text>
            <Text style={S.partyLine}>GSTIN: 29AAGCP1234A1Z5</Text>
            <Text style={S.partyLine}>Bangalore, Karnataka — 560001</Text>
          </View>
          <View style={S.partyBlock}>
            <Text style={S.partyLabel}>Consignee (Deliver To)</Text>
            <Text style={S.partyName}>{order.address_name}</Text>
            {order.company_name && <Text style={S.partyLine}>{order.company_name}</Text>}
            <Text style={S.partyLine}>{order.address_line1}</Text>
            {order.address_line2 ? <Text style={S.partyLine}>{order.address_line2}</Text> : null}
            <Text style={S.partyLine}>{order.address_city}, {order.address_state} — {order.address_pincode}</Text>
            <Text style={S.partyLine}>Ph: {order.address_phone}</Text>
          </View>
        </View>

        <View style={S.divider} />

        {/* Items table (no pricing) */}
        <View style={S.tableHeader}>
          <Text style={[S.colSno, S.thText]}>#</Text>
          <Text style={[S.colDesc, S.thText]}>Item Description</Text>
          <Text style={[S.colQty, S.thText]}>Qty</Text>
          <Text style={[S.colUnit, S.thText]}>Unit</Text>
        </View>

        {order.items.map((item, idx) => (
          <View key={idx} style={idx % 2 === 0 ? S.tableRow : S.tableRowAlt}>
            <Text style={S.colSno}>{idx + 1}</Text>
            <View style={S.colDesc}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#1e293b' }}>{item.product_name}</Text>
              {item.product_sku ? <Text style={{ fontSize: 7, color: '#94a3b8' }}>SKU: {item.product_sku}</Text> : null}
            </View>
            <Text style={[S.colQty, { fontSize: 8 }]}>{item.quantity}</Text>
            <Text style={[S.colUnit, { fontSize: 8 }]}>Pcs</Text>
          </View>
        ))}

        {/* Driver / transport + signature fields */}
        <View style={S.grid2}>
          <View style={S.fieldBlock}>
            <Text style={S.fieldLabel}>Transporter / Driver Details</Text>
            <Text style={[S.fieldLabel, { marginTop: 10 }]}>Driver Name:</Text>
            <View style={S.fieldLine} />
            <Text style={[S.fieldLabel, { marginTop: 8 }]}>Vehicle No:</Text>
            <View style={S.fieldLine} />
            <Text style={[S.fieldLabel, { marginTop: 8 }]}>Contact No:</Text>
            <View style={S.fieldLine} />
          </View>
          <View style={S.sigBox}>
            <Text style={S.sigLabel}>Receiver&apos;s Signature</Text>
            <View>
              <View style={S.sigLine} />
              <Text style={S.sigName}>Name &amp; Date</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={S.footer} fixed>
          <View style={S.footerLine}>
            <Text style={S.footerText}>
              This Delivery Challan does not constitute a tax invoice.{'\n'}
              PrimeServe Facility Solutions Pvt. Ltd. | credit@primeserve.in
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
