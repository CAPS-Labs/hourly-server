export interface Role {
    id: number | string;
    title: string;
    isStaff: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateRoleDTO {
    title: string;
    isStaff: boolean;
}

export interface UpdateRoleDTO {
    title?: string;
    isStaff?: boolean;
}