export interface Staff {
    id: number | string;
    user_id: number | string;
    role: number | string;
    created_at: Date;
}

export interface UpdateStaffDTO {
    role?: number | string;
}