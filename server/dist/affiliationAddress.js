import { db } from "./db.js";
/** 列表/详情：关联地址字段（未分配时 detail 为空） */
export const AFFILIATION_ROW_SELECT = `
  SELECT r.*,
    r.requested_address_type,
    r.requested_address_region,
    COALESCE(a.address_type, r.requested_address_type) AS address_type,
    COALESCE(a.address_region, r.requested_address_region) AS address_region,
    a.detail_address
  FROM affiliation_requests r
  LEFT JOIN addresses a ON a.id = r.address_id`;
/** 与列表占用展示、审批分配共用：是否存在「已通过」且绑定该 address_id 的申请 */
export const ADDRESS_NOT_OCCUPIED_SQL = `NOT EXISTS (
  SELECT 1 FROM affiliation_requests r
  WHERE r.address_id = a.id AND r.status = 'approved'
)`;
/** 管理员地址库列表：附带当前占用（已通过挂靠） */
export const ADDRESS_ADMIN_LIST_FROM = `
  FROM addresses a
  LEFT JOIN affiliation_requests occ ON occ.address_id = a.id
    AND occ.status = 'approved'
    AND occ.id = (
      SELECT r2.id FROM affiliation_requests r2
      WHERE r2.address_id = a.id AND r2.status = 'approved'
      ORDER BY COALESCE(r2.reviewed_at, r2.updated_at) DESC, r2.id
      LIMIT 1
    )`;
export const ADDRESS_ADMIN_SELECT = `
  SELECT a.*,
    CASE WHEN occ.id IS NOT NULL THEN 'occupied' ELSE 'available' END AS occupancy_status,
    occ.id AS occupied_affiliation_id,
    occ.applicant_name AS occupied_applicant_name,
    occ.reviewed_at AS occupied_reviewed_at
  ${ADDRESS_ADMIN_LIST_FROM}`;
export function getAddressAdminById(id) {
    return db.prepare(`${ADDRESS_ADMIN_SELECT} WHERE a.id = ?`).get(id);
}
export function isAddressOccupied(addressId) {
    const row = db
        .prepare(`SELECT 1 AS x FROM affiliation_requests WHERE address_id = ? AND status = 'approved' LIMIT 1`)
        .get(addressId);
    return !!row;
}
/** 从地址库选取尚未被「已通过」申请占用的地址（同类型、同区域，先到先得） */
export function findAvailableAddressId(type, region) {
    const regionTrim = region.trim();
    const row = db
        .prepare(`SELECT a.id FROM addresses a
       WHERE a.address_type = ? AND TRIM(a.address_region) = ?
         AND ${ADDRESS_NOT_OCCUPIED_SQL}
       ORDER BY a.created_at ASC
       LIMIT 1`)
        .get(type, regionTrim);
    return row?.id ?? null;
}
export function isRegionValidForAddressType(type, region) {
    const regionTrim = region.trim();
    if (!regionTrim)
        return false;
    return listRegionsForAddressType(type).includes(regionTrim);
}
export function listRegionsForAddressType(type) {
    const rows = db
        .prepare(`SELECT DISTINCT TRIM(address_region) AS address_region
       FROM addresses WHERE address_type = ?
       ORDER BY address_region COLLATE NOCASE`)
        .all(type);
    return rows.map((r) => r.address_region).filter(Boolean);
}
