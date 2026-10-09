import { File, Paths } from 'expo-file-system';
import { ProjectMetadata, GifProject } from '../../types/project';

const PROJECTS_METADATA_FILE = 'recent_projects.json';

class ProjectStoreService {
  private getStorageFile(): File {
    return new File(Paths.document, PROJECTS_METADATA_FILE);
  }

  public async getRecentProjects(): Promise<ProjectMetadata[]> {
    try {
      const file = this.getStorageFile();
      if (!file.exists) {
        return [];
      }
      const content = await file.text();
      if (!content) return [];
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public async saveProject(project: GifProject): Promise<void> {
    try {
      const file = this.getStorageFile();
      const currentProjects = await this.getRecentProjects();
      const existingIndex = currentProjects.findIndex(p => p.id === project.metadata.id);

      const updatedMetadata: ProjectMetadata = {
        ...project.metadata,
        updatedAt: Date.now()
      };

      let newProjects: ProjectMetadata[];
      if (existingIndex >= 0) {
        newProjects = [...currentProjects];
        newProjects[existingIndex] = updatedMetadata;
      } else {
        newProjects = [updatedMetadata, ...currentProjects];
      }

      // Also save the full project details
      const projectDetailFile = new File(Paths.document, `project_${project.metadata.id}.json`);
      if (projectDetailFile.exists) {
        projectDetailFile.delete();
      }
      projectDetailFile.create();
      projectDetailFile.write(JSON.stringify(project));

      // Save index
      if (file.exists) {
        file.delete();
      }
      file.create();
      file.write(JSON.stringify(newProjects.slice(0, 20))); // keep 20 recent
    } catch (e) {
      console.warn('Failed to save project', e);
    }
  }

  public async getProject(id: string): Promise<GifProject | null> {
    try {
      const projectDetailFile = new File(Paths.document, `project_${id}.json`);
      if (!projectDetailFile.exists) return null;
      const text = await projectDetailFile.text();
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  public async deleteProject(id: string): Promise<void> {
    try {
      const projects = await this.getRecentProjects();
      const filtered = projects.filter(p => p.id !== id);
      const file = this.getStorageFile();
      if (file.exists) file.delete();
      file.create();
      file.write(JSON.stringify(filtered));

      const projectDetailFile = new File(Paths.document, `project_${id}.json`);
      if (projectDetailFile.exists) {
        projectDetailFile.delete();
      }
    } catch (e) {
      console.warn('Failed to delete project', e);
    }
  }

  public async clearAllProjects(): Promise<void> {
    try {
      const file = this.getStorageFile();
      if (file.exists) file.delete();
    } catch {}
  }
}

export const projectStore = new ProjectStoreService();
