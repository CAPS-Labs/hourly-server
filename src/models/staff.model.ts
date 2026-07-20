export interface Staff {
    id: number | string;
    userId: number | string;
    role: number | string;
    createdAt: Date;
    updatedAt: Date;
}

export interface UpdateStaffDTO {
    role?: number | string;
}