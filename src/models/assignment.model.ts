export interface Assignment {
    assigned_user: number | string;
    project_assigned_to: number | string;
    role_assigned: string; //Should this be a foreign key connected to roles?
    created_at: Date;
}

//Do I need an update DTO?