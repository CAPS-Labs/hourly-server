export interface Role {
    id: number | string;
    title: string;
    isStaff: boolean;
    createdAt: Date;
}

export interface CreateRoleDTO {
    title: string;
    isStaff: boolean;
}

export interface UpdateRoleDTO {
    title?: string;
    isStaff?: boolean;
}