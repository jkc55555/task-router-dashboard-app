import { prisma } from "../lib/prisma.js";

export async function listAreas(userId: string, includeArchived = false) {
  return prisma.areaOfFocus.findMany({
    where: {
      userId,
      ...(includeArchived ? {} : { archivedAt: null }),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function getArea(id: string, userId: string) {
  return prisma.areaOfFocus.findFirst({
    where: { id, userId },
  });
}

export async function createArea(
  userId: string,
  data: { name: string; description?: string; color?: string; sortOrder?: number }
) {
  const name = data.name.trim();
  if (!name) throw new Error("Name is required");
  const existing = await prisma.areaOfFocus.findFirst({
    where: { userId, name },
  });
  if (existing) throw new Error("An area with this name already exists");
  const maxOrder = await prisma.areaOfFocus.aggregate({
    where: { userId },
    _max: { sortOrder: true },
  });
  const sortOrder = data.sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1;
  return prisma.areaOfFocus.create({
    data: {
      userId,
      name,
      description: data.description?.trim() || null,
      color: data.color?.trim() || null,
      sortOrder,
    },
  });
}

export async function patchArea(
  id: string,
  userId: string,
  data: { name?: string; description?: string | null; color?: string | null; sortOrder?: number }
) {
  const area = await getArea(id, userId);
  if (!area) return null;
  const updates: { name?: string; description?: string | null; color?: string | null; sortOrder?: number } = {};
  if (data.name !== undefined) {
    const name = data.name.trim();
    if (!name) throw new Error("Name cannot be empty");
    const existing = await prisma.areaOfFocus.findFirst({
      where: { userId, name, id: { not: id } },
    });
    if (existing) throw new Error("An area with this name already exists");
    updates.name = name;
  }
  if (data.description !== undefined) updates.description = data.description == null ? null : data.description.trim() || null;
  if (data.color !== undefined) updates.color = data.color?.trim() || null;
  if (data.sortOrder !== undefined) updates.sortOrder = data.sortOrder;
  return prisma.areaOfFocus.update({
    where: { id },
    data: updates,
  });
}

export async function archiveArea(id: string, userId: string) {
  const area = await getArea(id, userId);
  if (!area) return null;
  await prisma.project.updateMany({
    where: { areaId: id },
    data: { areaId: null },
  });
  return prisma.areaOfFocus.update({
    where: { id },
    data: { archivedAt: new Date(), isActive: false },
  });
}

export async function restoreArea(id: string, userId: string) {
  const area = await getArea(id, userId);
  if (!area) return null;
  return prisma.areaOfFocus.update({
    where: { id },
    data: { archivedAt: null, isActive: true },
  });
}

export async function acknowledgeArea(
  id: string,
  userId: string,
  note?: string
) {
  const area = await getArea(id, userId);
  if (!area) return null;
  return prisma.areaOfFocus.update({
    where: { id },
    data: { lastAcknowledgedAt: new Date(), lastAcknowledgedNote: note?.trim() || null },
  });
}
