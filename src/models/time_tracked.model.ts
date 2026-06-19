export interface TimeTracked {
    submission_id: string | number;
    user: string | number;
    project_tracked_to: string | number;
    service_date: Date | string;
    minutes_served: number;
    description?: string;
}

export interface UpdateTimeDTO {
    project_tracked_to?: string | number;
    service_date?: Date | string;
    minutes_served?: number;
    description?: string;
}