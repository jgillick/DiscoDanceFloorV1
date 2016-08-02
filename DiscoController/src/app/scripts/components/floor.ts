/**
 * Builds a visual representation of the dance floor which scales with the page.
 */

import { 
  Component, 
  ElementRef, 
  OnInit 
} from '@angular/core';

import { FloorCell } from '../../../shared/floor-cell';
import { StorageService } from '../services/storage.service';
import { FloorBuilderService } from '../services/floor-builder.service';
import { CommunicationService } from '../services/communication.service';
import { ProgramControllerComponent } from './program-controller';

@Component({
  selector: 'disco-floor',
  templateUrl: './html/disco-floor.html',
  styleUrls: ['./styles/floor.css'],
  directives: [ ProgramControllerComponent ],
})
export class DiscoFloorComponent implements OnInit  {

  /**
   * The height/width CSS value for each floor cell
   */
  cellSize: string|number = "100%";

  /**
   * The x length of the floor
   */
  x:number = 0;

  /**
   * The y length of the floor
   */
  y:number = 0;

  /**
   * The table cell grid.
   * A nested array of x and then y.
   */
  tableCells:FloorCell[][] = [];

  constructor(
    public comm:CommunicationService,
    private _element:ElementRef,
    private _store:StorageService,
    private _builder:FloorBuilderService) {
  }

  /**
   * Load floor
   */
  ngOnInit() {
    let settings = this._store.getItem('settings');

    if (settings && settings.dimensions) {
      this.x = settings.dimensions.x;
      this.y = settings.dimensions.y;
      this.cellSize = "100%";

      // Build Y/X axis for table
      this.tableCells = [];
      let cells = this._builder.cellList;
      for (var i = 0; i < cells.length; i++) {
        let cell = cells.atIndex(i),
            y = cell.y,
            x = cell.x;

        this.tableCells[y] = this.tableCells[y] || [];
        this.tableCells[y][x] = cell;
      }
    }
  }

  /**
   * Once the view has been initialized.
   */
  ngAfterViewInit() {
    setTimeout(this.sizeFloor.bind(this), 0);
  }

  /**
   * Set the size of the floor to fit the window while maintain the aspect ratio
   * so all cells are square
   */
  sizeFloor() {
    let component = $(this._element.nativeElement),
        container = component.find('.floor-area'),
        width = container.width(),
        height = container.height(),
        ratio = this.x / this.y,
        size;

    if (!width || !height) {
      return;
    }

    // Set based on width
    if (width > ratio * height) {
      size = ratio * height;
      size = (size > height) ? height : size;
      this.cellSize = Math.floor(size / this.x);
    }
    // Set based on height
    else if (height > width / ratio) {
      size = width / ratio;
      size = (size > width) ? width : size;
      this.cellSize = Math.floor(size / this.y);
    }
  }

  /**
   * Get the color CSS for a floor cell
   */
  cellColorCSS(floorCell: FloorCell): string {
    // Round colors and make a CSS string
    let colorValues = floorCell.color.map( c => Math.round(c) ),
        colorCss = `rgb(${colorValues.join(',')})`;
    
    return colorCss;
  }

  /**
   * Toggle the touch sensor value for a cell
   */
  toggleSensorValue(floorCell: FloorCell): void {
    floorCell.sensorValue = !floorCell.sensorValue; 
  }
}