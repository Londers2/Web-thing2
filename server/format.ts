export function mapOrder(row: any) {
  return {
    id: row.id,
    number: Number(row.number),
    title: row.title,
    description: row.description,
    address: row.address,
    addressLat: row.address_lat,
    addressLng: row.address_lng,
    priceListId: row.price_list_id,
    status: row.status,
    amount: Number(row.amount),
    advanceAmount: Number(row.advance_amount),
    assemblyAmount: row.assembly_amount === null ? null : Number(row.assembly_amount),
    nearestDeadline: row.nearest_deadline || null,
    clientId: row.client_id,
    client: row.client_id ? {
      id: row.client_id,
      name: row.client_name,
      callSign: row.client_call_sign,
      email: row.client_email,
      phone: row.client_phone,
    } : undefined,
    creatorId: row.creator_id,
    creator: row.creator_id ? { id: row.creator_id, name: row.creator_name, email: row.creator_email, avatarUrl: row.creator_avatar_url } : undefined,
    members: row.members || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    taskTotal: row.task_total === undefined ? undefined : Number(row.task_total),
    taskDone: row.task_done === undefined ? undefined : Number(row.task_done),
    imageCount: row.image_count === undefined ? undefined : Number(row.image_count),
  }
}

export const orderSelect = `
  SELECT orders.*, clients.name AS client_name, clients.call_sign AS client_call_sign,
    clients.email AS client_email, clients.phone AS client_phone,
    creators.name AS creator_name, creators.email AS creator_email, creators.avatar_url AS creator_avatar_url,
    (SELECT MIN(tasks.due_date) FROM tasks WHERE tasks.order_id = orders.id AND tasks.completed = FALSE) AS nearest_deadline,
    COALESCE((
      SELECT json_agg(json_build_object('id', users.id, 'name', users.name, 'email', users.email, 'avatarUrl', users.avatar_url, 'canEdit', order_members.can_edit) ORDER BY users.name)
      FROM order_members JOIN users ON users.id = order_members.user_id
      WHERE order_members.order_id = orders.id
    ), '[]') AS members
  FROM orders
  JOIN clients ON clients.id = orders.client_id
  JOIN users creators ON creators.id = orders.creator_id
`
