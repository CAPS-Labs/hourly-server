export interface TimeTracked {
    submissionId: string | number;
    user: string | number;
    projectTrackedTo: string | number;
    serviceDate: Date | string;
    minutesServed: number;
    description?: string;
}

export interface UpdateTimeDTO {
    projectTrackedTo?: string | number;
    serviceDate?: Date | string;
    minutesServed?: number;
    description?: string;
}