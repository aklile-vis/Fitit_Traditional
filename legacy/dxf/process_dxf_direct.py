#!/usr/bin/env python3
"""
Direct DXF Processing CLI

Professional, testable command-line wrapper around the robust processing
pipeline. Provides structured JSON output for automation.
"""

import sys
import os
import json
import logging
import argparse
from pathlib import Path
from datetime import datetime

# Add backend to path
sys.path.append('backend')

from backend.robust_processor import RobustProcessor

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def process_dxf_file(dxf_path: str, output_dir: str = "output") -> dict:
    """
    Process a DXF file directly and generate all outputs
    
    Args:
        dxf_path: Path to the DXF file
        output_dir: Directory to save outputs
    
    Returns:
        dict: Processing results
    """
    try:
        # Validate input file
        if not os.path.exists(dxf_path):
            return {
                'success': False,
                'error': f"DXF file not found: {dxf_path}"
            }
        
        if not dxf_path.lower().endswith('.dxf'):
            return {
                'success': False,
                'error': f"File is not a DXF file: {dxf_path}"
            }
        
        logger.info(f"Starting direct processing of: {dxf_path}")
        
        # Create output directory
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)
        
        # Initialize processor
        processor = RobustProcessor(str(output_path))
        
        # Process the file
        result = processor.process_dxf_file(dxf_path, "direct_processing")
        
        if result['success']:
            logger.info("✅ Processing completed successfully!")
            logger.info(f"📁 IFC file: {result.get('ifc_path', 'N/A')}")
            logger.info(f"📁 GLB file: {result.get('glb_path', 'N/A')}")
            logger.info(f"📁 USD file: {result.get('usd_path', 'N/A')}")
            logger.info(f"📊 Elements extracted: {len(result.get('elements', []))}")
            
            # Create summary file
            summary_file = output_path / f"{Path(dxf_path).stem}_summary.txt"
            with open(summary_file, 'w') as f:
                f.write(f"DXF Processing Summary\n")
                f.write(f"=====================\n")
                f.write(f"Input file: {dxf_path}\n")
                f.write(f"Processed: {datetime.now().isoformat()}\n")
                f.write(f"Status: SUCCESS\n")
                f.write(f"Elements: {len(result.get('elements', []))}\n")
                f.write(f"IFC: {result.get('ifc_path', 'N/A')}\n")
                f.write(f"GLB: {result.get('glb_path', 'N/A')}\n")
                f.write(f"USD: {result.get('usd_path', 'N/A')}\n")
            
            logger.info(f"📄 Summary saved: {summary_file}")
            
            # annotate result with standard fields for consumers
            result = {
                'success': True,
                'ifcPath': result.get('ifc_path'),
                'glbPath': result.get('glb_path'),
                'usdPath': result.get('usd_path'),
                'elementsCount': len(result.get('elements', [])),
                'summaryPath': str(summary_file),
                'report': result.get('report'),
                'warnings': []
            }

        else:
            logger.error(f"❌ Processing failed: {result.get('error', 'Unknown error')}")
            result = {
                'success': False,
                'error': result.get('error', 'Unknown error')
            }

        return result
        
    except Exception as e:
        logger.error(f"❌ Error processing file: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

def main():
    """CLI entrypoint"""
    parser = argparse.ArgumentParser(description='Direct DXF processing (IFC/USD/GLB)')
    parser.add_argument('dxf_file', help='Path to DXF file')
    parser.add_argument('-o', '--output', default='output', help='Output directory (default: output)')
    parser.add_argument('--json', action='store_true', help='Emit machine-readable JSON to stdout')
    parser.add_argument('--log-level', default='INFO', choices=['DEBUG','INFO','WARNING','ERROR'], help='Log level')
    args = parser.parse_args()

    # set log level
    logging.getLogger().setLevel(getattr(logging, args.log_level))

    print(f"🚀 Direct DXF Processing")
    print(f"📁 Input: {args.dxf_file}")
    print(f"📁 Output: {args.output}")
    print(f"⏰ Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("-" * 50)

    result = process_dxf_file(args.dxf_file, args.output)

    if args.json:
        # ensure plain JSON on stdout for automation
        sys.stdout.write(json.dumps(result))
        sys.stdout.flush()

    if result.get('success'):
        print("-" * 50)
        print("🎉 SUCCESS! All files generated successfully.")
        print(f"📁 Check the '{args.output}' directory for outputs.")
        sys.exit(0)
    else:
        print("-" * 50)
        print(f"❌ FAILED: {result.get('error','Unknown error')}")
        sys.exit(2)

if __name__ == "__main__":
    main()
